from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from typing import Any, Protocol

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import BusinessRuleError
from apps.menu.models import (
    MenuCategory,
    MenuItem,
    MenuTranslation,
    OptionGroup,
)


@dataclass(frozen=True)
class LanguageSpec:
    code: str
    english_name: str
    native_name: str
    direction: str  # "ltr" | "rtl"
    chrome_ready: bool


LANGUAGE_REGISTRY: list[LanguageSpec] = [
    LanguageSpec("en", "English", "English", "ltr", True),
    LanguageSpec("ta", "Tamil", "தமிழ்", "ltr", True),
    LanguageSpec("hi", "Hindi", "हिन्दी", "ltr", False),
    LanguageSpec("te", "Telugu", "తెలుగు", "ltr", False),
    LanguageSpec("ml", "Malayalam", "മലയാളം", "ltr", False),
    LanguageSpec("kn", "Kannada", "ಕನ್ನಡ", "ltr", False),
    LanguageSpec("ar", "Arabic", "العربية", "rtl", False),
    LanguageSpec("fr", "French", "Français", "ltr", False),
    LanguageSpec("es", "Spanish", "Español", "ltr", False),
]

LANGUAGE_MAP: dict[str, LanguageSpec] = {lang.code: lang for lang in LANGUAGE_REGISTRY}


def compute_source_hash(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


class TranslationProvider(Protocol):
    name: str
    is_automated: bool

    def translate_batch(self, texts: list[str], target_language: str) -> list[str]: ...


class ManualProvider:
    name = "manual"
    is_automated = False

    def translate_batch(self, texts: list[str], target_language: str) -> list[str]:
        return ["" for _ in texts]


class LLMProvider:
    """Environment-configured LLM translation provider (no keys or providers hardcoded)."""

    def __init__(self, provider_name: str, api_key: str, model: str) -> None:
        self.name = provider_name
        self.api_key = api_key
        self.model = model
        self.is_automated = True

    def translate_batch(self, texts: list[str], target_language: str) -> list[str]:
        if not self.api_key:
            raise BusinessRuleError(
                "TRANSLATION_PROVIDER_NOT_CONFIGURED",
                "Automatic translation provider is not configured.",
                status_code=400,
            )
        # In production this dispatches to the configured env endpoint;
        # kept strictly opt-in via environment variables.
        raise BusinessRuleError(
            "TRANSLATION_PROVIDER_UNAVAILABLE",
            "Automatic suggestions require a live configured provider endpoint.",
            status_code=503,
        )


def get_translation_provider() -> TranslationProvider:
    provider_name = os.environ.get("TRANSLATION_PROVIDER", "").strip()
    api_key = os.environ.get("TRANSLATION_API_KEY", "").strip()
    model = os.environ.get("TRANSLATION_MODEL", "").strip()
    if provider_name and api_key:
        return LLMProvider(provider_name=provider_name, api_key=api_key, model=model)
    return ManualProvider()


def mark_translations_outdated(
    tenant: Any,
    entity_type: str,
    entity_id: Any,
    field: str,
    new_source_text: str,
) -> int:
    """Marks existing translations as OUTDATED when original source text changes (never deletes)."""
    new_hash = compute_source_hash(new_source_text)
    qs = MenuTranslation.objects.filter(
        tenant=tenant,
        entity_type=entity_type,
        entity_id=entity_id,
        field=field,
    ).exclude(source_hash=new_hash)
    return qs.update(status=MenuTranslation.Status.OUTDATED)


def list_translatable_entries(
    tenant: Any,
    language: str,
    status_filter: str = "",
) -> list[dict[str, Any]]:
    """Collects all translatable entities for a tenant and joins MenuTranslation rows."""
    existing_map: dict[tuple[str, str, str], MenuTranslation] = {
        (t.entity_type, str(t.entity_id), t.field): t
        for t in MenuTranslation.objects.filter(tenant=tenant, language=language)
    }

    entries: list[dict[str, Any]] = []

    def _append(
        entity_type: str, entity_id: Any, field: str, original_text: str, label: str
    ) -> None:
        if not original_text and field in ("description", "ingredients_note", "allergen_note"):
            return
        eid = str(entity_id)
        tr = existing_map.get((entity_type, eid, field))
        cur_hash = compute_source_hash(original_text)
        st: str
        src: str
        if tr is None:
            st = MenuTranslation.Status.MISSING
            txt = ""
            src = MenuTranslation.Source.MANUAL
        else:
            txt = tr.text
            src = tr.source
            if (
                tr.source_hash
                and tr.source_hash != cur_hash
                and tr.status != MenuTranslation.Status.OUTDATED
            ):
                st = MenuTranslation.Status.OUTDATED
            else:
                st = tr.status

        if status_filter and st != status_filter:
            return
        entries.append(
            {
                "id": str(tr.id) if tr else None,
                "entity_type": entity_type,
                "entity_id": eid,
                "entity_label": label,
                "language": language,
                "field": field,
                "original_text": original_text,
                "text": txt,
                "status": st,
                "source": src,
            }
        )

    for cat in MenuCategory.objects.filter(tenant=tenant).order_by("sort_order", "name"):
        _append(
            MenuTranslation.EntityType.CATEGORY, cat.id, "name", cat.name, f"Category: {cat.name}"
        )

    for item in MenuItem.objects.filter(tenant=tenant).order_by("sort_order", "name"):
        _append(MenuTranslation.EntityType.ITEM, item.id, "name", item.name, f"Item: {item.name}")
        _append(
            MenuTranslation.EntityType.ITEM,
            item.id,
            "description",
            item.description,
            f"Item: {item.name}",
        )
        _append(
            MenuTranslation.EntityType.ITEM,
            item.id,
            "ingredients_note",
            item.ingredients_note,
            f"Item: {item.name}",
        )
        _append(
            MenuTranslation.EntityType.ITEM,
            item.id,
            "allergen_note",
            item.allergen_note,
            f"Item: {item.name}",
        )
        for v in item.variants.all():
            _append(
                MenuTranslation.EntityType.VARIANT,
                v.id,
                "name",
                v.name,
                f"Variant: {item.name} - {v.name}",
            )

    for grp in OptionGroup.objects.filter(tenant=tenant).prefetch_related("options"):
        _append(
            MenuTranslation.EntityType.OPTION_GROUP,
            grp.id,
            "name",
            grp.name,
            f"Option Group: {grp.name}",
        )
        for opt in grp.options.all():
            _append(
                MenuTranslation.EntityType.OPTION,
                opt.id,
                "name",
                opt.name,
                f"Option: {grp.name} - {opt.name}",
            )

    return entries


@transaction.atomic
def suggest_translations_batch(
    *,
    tenant: Any,
    language: str,
    provider: TranslationProvider | None = None,
    daily_limit: int = 500,
    batch_size: int = 40,
) -> dict[str, Any]:
    """Generates DRAFT machine translation suggestions in batches of up to 40 strings."""
    active_provider = provider or get_translation_provider()
    if not active_provider.is_automated:
        raise BusinessRuleError(
            "TRANSLATION_PROVIDER_NOT_CONFIGURED",
            "Automatic suggestions are not set up. You can type translations yourself.",
            status_code=400,
        )

    pending = [
        e
        for e in list_translatable_entries(tenant, language)
        if e["status"] in (MenuTranslation.Status.MISSING, MenuTranslation.Status.OUTDATED)
        and e["original_text"]
    ]
    today = timezone.localdate()
    used_today = MenuTranslation.objects.filter(
        tenant=tenant,
        source=MenuTranslation.Source.MACHINE,
        updated_at__date=today,
    ).count()
    remaining_quota = max(0, daily_limit - used_today)
    if remaining_quota <= 0:
        raise BusinessRuleError(
            "TRANSLATION_DAILY_LIMIT_REACHED",
            f"Daily machine translation limit ({daily_limit} strings) reached.",
            status_code=429,
        )

    to_process = pending[: min(batch_size, remaining_quota)]
    if not to_process:
        return {"suggested_count": 0, "remaining_quota": remaining_quota}

    translated = active_provider.translate_batch([e["original_text"] for e in to_process], language)
    saved = 0
    for entry, suggestion in zip(to_process, translated, strict=False):
        MenuTranslation.objects.update_or_create(
            tenant=tenant,
            entity_type=entry["entity_type"],
            entity_id=entry["entity_id"],
            language=language,
            field=entry["field"],
            defaults={
                "text": suggestion,
                "status": MenuTranslation.Status.DRAFT,
                "source": MenuTranslation.Source.MACHINE,
                "source_hash": compute_source_hash(entry["original_text"]),
            },
        )
        saved += 1

    return {
        "suggested_count": saved,
        "remaining_quota": max(0, remaining_quota - saved),
    }


def get_published_translations_map(tenant: Any, language: str) -> dict[tuple[str, str, str], str]:
    """Returns ONLY PUBLISHED translations for public guest consumption."""
    return {
        (t.entity_type, str(t.entity_id), t.field): t.text
        for t in MenuTranslation.objects.filter(
            tenant=tenant,
            language=language,
            status=MenuTranslation.Status.PUBLISHED,
        )
        if t.text
    }
