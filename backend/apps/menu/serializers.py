from rest_framework import serializers

from apps.menu.models import (
    BranchItemAvailability,
    ItemVariant,
    MenuCategory,
    MenuItem,
    Option,
    OptionGroup,
)


class MenuCategorySerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = MenuCategory
        fields = [
            "id",
            "name",
            "name_ta",
            "sort_order",
            "is_active",
            "items_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "items_count"]

    def get_items_count(self, obj: MenuCategory) -> int:
        return obj.items.count()


class ItemVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemVariant
        fields = [
            "id",
            "name",
            "name_ta",
            "price_paise",
            "is_default",
            "sort_order",
        ]
        read_only_fields = ["id"]


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = [
            "id",
            "name",
            "name_ta",
            "price_delta_paise",
            "is_default",
            "is_active",
            "sort_order",
        ]
        read_only_fields = ["id"]


class OptionGroupSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, required=False)

    class Meta:
        model = OptionGroup
        fields = [
            "id",
            "name",
            "name_ta",
            "min_select",
            "max_select",
            "sort_order",
            "is_active",
            "options",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        options_data = validated_data.pop("options", [])
        group = super().create(validated_data)
        for opt_data in options_data:
            Option.objects.create(group=group, **opt_data)
        return group

    def update(self, instance, validated_data):
        options_data = validated_data.pop("options", None)
        instance = super().update(instance, validated_data)
        if options_data is not None:
            # Replace or update options
            instance.options.all().delete()
            for opt_data in options_data:
                Option.objects.create(group=instance, **opt_data)
        return instance


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    variants = ItemVariantSerializer(many=True, read_only=True)
    option_groups = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "category",
            "category_name",
            "name",
            "name_ta",
            "description",
            "description_ta",
            "base_price_paise",
            "food_type",
            "prep_minutes",
            "is_bestseller",
            "is_active",
            "sort_order",
            "image_original",
            "image_card",
            "image_thumb",
            "image_bytes",
            "image_focus_x",
            "image_focus_y",
            "variants",
            "option_groups",
            "is_available",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "image_original",
            "image_card",
            "image_thumb",
            "image_bytes",
            "created_at",
            "updated_at",
            "category_name",
            "variants",
            "option_groups",
            "is_available",
        ]

    def get_option_groups(self, obj: MenuItem) -> list[dict]:
        links = (
            obj.item_option_groups.select_related("group").prefetch_related("group__options").all()
        )
        return [OptionGroupSerializer(link.group).data for link in links]

    def get_is_available(self, obj: MenuItem) -> bool:
        branch_id = self.context.get("branch_id")
        if not branch_id:
            return True
        avail = obj.branch_availabilities.filter(branch_id=branch_id).first()
        return avail.is_available if avail else True


class BranchItemAvailabilitySerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    category_name = serializers.CharField(source="item.category.name", read_only=True)

    class Meta:
        model = BranchItemAvailability
        fields = [
            "id",
            "branch",
            "item",
            "item_name",
            "category_name",
            "is_available",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at", "item_name", "category_name"]
