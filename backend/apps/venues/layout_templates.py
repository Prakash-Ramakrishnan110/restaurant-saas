from typing import Any

from apps.core.exceptions import BusinessRuleError
from apps.venues.constants import AreaType, TableShape, TableType


def get_template_catalog() -> list[dict[str, Any]]:
    """Return catalog of available layout templates with metadata."""
    return [
        {
            "key": "cafe_small",
            "name": "Cozy Café",
            "description": "1 dining area with 10 tables, ideal for small cafes, bistros, and coffee shops.",
            "recommended_profiles": ["CAFE", "QUICK_SERVICE"],
            "has_tables": True,
            "params_schema": {},
        },
        {
            "key": "restaurant_3_sections",
            "name": "Casual Dining (3 Sections)",
            "description": "Dining Hall with 3 distinct zones: AC Hall (12 tables), Family (8 tables), and Outdoor (6 tables).",
            "recommended_profiles": ["CASUAL_DINING", "BAR_BREWERY"],
            "has_tables": True,
            "params_schema": {},
        },
        {
            "key": "fine_dining",
            "name": "Fine Dining & Lounge",
            "description": "Elegant arrangement featuring Main Dining (8 tables), Bar Seats (6 seats), and Private Booths (6 booths).",
            "recommended_profiles": ["FINE_DINING"],
            "has_tables": True,
            "params_schema": {},
        },
        {
            "key": "hotel",
            "name": "Hotel & Multi-Floor Property",
            "description": "Multi-floor room service rooms plus Lobby Café, Rooftop dining, and Banquet Hall.",
            "recommended_profiles": ["HOTEL_RESTAURANT"],
            "has_tables": True,
            "params_schema": {
                "floors": {"type": "integer", "min": 1, "max": 10, "default": 2},
                "rooms_per_floor": {"type": "integer", "min": 1, "max": 40, "default": 10},
            },
        },
        {
            "key": "counters",
            "name": "Counters & Tokens (No Tables)",
            "description": "Counter service stations with atomic daily token numbers. Zero dining tables.",
            "recommended_profiles": ["QUICK_SERVICE", "FOOD_COURT"],
            "has_tables": False,
            "params_schema": {
                "count": {"type": "integer", "min": 1, "max": 12, "default": 2},
                "names": {"type": "array", "items": {"type": "string"}, "default": []},
            },
        },
        {
            "key": "empty",
            "name": "Custom Blank Canvas",
            "description": "Blank canvas with one starter area and section, ready for custom manual layout design.",
            "recommended_profiles": [
                "CAFE",
                "CASUAL_DINING",
                "FINE_DINING",
                "HOTEL_RESTAURANT",
                "QUICK_SERVICE",
                "FOOD_COURT",
                "BAR_BREWERY",
            ],
            "has_tables": False,
            "params_schema": {},
        },
    ]


def build_template_spec(key: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Generates the structured area, section, and table creation specification for a template key.

    Returns dict with:
    - areas: list of area definitions with nested sections and tables
    - token_counters: list of token counter definitions
    - summary: counts of {areas, sections, tables, counters}
    """
    params = params or {}
    areas: list[dict[str, Any]] = []
    counters: list[dict[str, Any]] = []

    if key == "cafe_small":
        # 10 tables, one dining area, one section
        tables = [
            {
                "label": f"T{i}",
                "capacity": 2 if i <= 4 else 4,
                "table_type": TableType.TABLE,
                "shape": TableShape.SQUARE,
                "x": float(100 + ((i - 1) % 5) * 120),
                "y": float(100 + ((i - 1) // 5) * 120),
            }
            for i in range(1, 11)
        ]
        areas = [
            {
                "name": "Dining Area",
                "area_type": AreaType.DINING,
                "sections": [
                    {
                        "name": "Main Seating",
                        "tables": tables,
                    }
                ],
            }
        ]
        counters = []

    elif key == "restaurant_3_sections":
        # Dining Hall with AC Hall (T1-T12), Family (F1-F8), Outdoor (O1-O6)
        ac_tables = [
            {
                "label": f"T{i}",
                "capacity": 4,
                "table_type": TableType.TABLE,
                "shape": TableShape.SQUARE,
                "x": float(80 + ((i - 1) % 4) * 110),
                "y": float(80 + ((i - 1) // 4) * 110),
            }
            for i in range(1, 13)
        ]
        family_tables = [
            {
                "label": f"F{i}",
                "capacity": 6,
                "table_type": TableType.TABLE,
                "shape": TableShape.RECT,
                "x": float(80 + ((i - 1) % 4) * 130),
                "y": float(80 + ((i - 1) // 4) * 110),
            }
            for i in range(1, 9)
        ]
        outdoor_tables = [
            {
                "label": f"O{i}",
                "capacity": 2 if i <= 2 else 4,
                "table_type": TableType.TABLE,
                "shape": TableShape.ROUND,
                "x": float(80 + ((i - 1) % 3) * 120),
                "y": float(80 + ((i - 1) // 3) * 120),
            }
            for i in range(1, 7)
        ]
        areas = [
            {
                "name": "Dining Hall",
                "area_type": AreaType.DINING,
                "sections": [
                    {"name": "AC Hall", "tables": ac_tables},
                    {"name": "Family", "tables": family_tables},
                    {"name": "Outdoor", "tables": outdoor_tables},
                ],
            }
        ]
        counters = []

    elif key == "fine_dining":
        # dining room (D1-D8), bar seats (B1-B6), booths (Booth 1-6)
        dining_tables = [
            {
                "label": f"D{i}",
                "capacity": 4,
                "table_type": TableType.TABLE,
                "shape": TableShape.ROUND,
                "x": float(100 + ((i - 1) % 4) * 120),
                "y": float(100 + ((i - 1) // 4) * 120),
            }
            for i in range(1, 9)
        ]
        bar_tables = [
            {
                "label": f"B{i}",
                "capacity": 1,
                "table_type": TableType.BAR_SEAT,
                "shape": TableShape.ROUND,
                "x": float(100 + (i - 1) * 70),
                "y": 100.0,
            }
            for i in range(1, 7)
        ]
        booths = [
            {
                "label": f"Booth {i}",
                "capacity": 6,
                "table_type": TableType.BOOTH,
                "shape": TableShape.RECT,
                "x": float(100 + ((i - 1) % 3) * 150),
                "y": float(100 + ((i - 1) // 3) * 130),
            }
            for i in range(1, 7)
        ]
        areas = [
            {
                "name": "Main Dining Room",
                "area_type": AreaType.DINING,
                "sections": [{"name": "Dining Room", "tables": dining_tables}],
            },
            {
                "name": "Bar & Lounge",
                "area_type": AreaType.BAR,
                "sections": [{"name": "Bar Area", "tables": bar_tables}],
            },
            {
                "name": "Private Booths",
                "area_type": AreaType.DINING,
                "sections": [{"name": "Booths Area", "tables": booths}],
            },
        ]
        counters = []

    elif key == "hotel":
        # params: floors 1-10, rooms_per_floor 1-40; plus lobby cafe, rooftop, banquet
        floors = int(params.get("floors", 2))
        rooms_per_floor = int(params.get("rooms_per_floor", 10))

        if floors < 1 or floors > 10:
            raise BusinessRuleError(
                "INVALID_TEMPLATE_PARAMS", "Floors must be between 1 and 10.", status_code=400
            )
        if rooms_per_floor < 1 or rooms_per_floor > 40:
            raise BusinessRuleError(
                "INVALID_TEMPLATE_PARAMS",
                "Rooms per floor must be between 1 and 40.",
                status_code=400,
            )

        areas = []
        for f in range(1, floors + 1):
            floor_rooms = [
                {
                    "label": f"Room {f}{r:02d}",
                    "capacity": 2,
                    "table_type": TableType.ROOM,
                    "shape": TableShape.RECT,
                    "x": float(80 + ((r - 1) % 5) * 110),
                    "y": float(80 + ((r - 1) // 5) * 110),
                }
                for r in range(1, rooms_per_floor + 1)
            ]
            areas.append(
                {
                    "name": f"Floor {f} (Rooms)",
                    "area_type": AreaType.ROOM_SERVICE,
                    "sections": [{"name": f"Floor {f} Wing", "tables": floor_rooms}],
                }
            )

        # Plus Lobby Cafe (4 tables), Rooftop (6 tables), Banquet (10 tables)
        lobby_tables = [
            {
                "label": f"L{i}",
                "capacity": 2,
                "table_type": TableType.TABLE,
                "shape": TableShape.ROUND,
                "x": float(100 + i * 90),
                "y": 100.0,
            }
            for i in range(1, 5)
        ]
        rooftop_tables = [
            {
                "label": f"R{i}",
                "capacity": 4,
                "table_type": TableType.TABLE,
                "shape": TableShape.SQUARE,
                "x": float(100 + ((i - 1) % 3) * 120),
                "y": float(100 + ((i - 1) // 3) * 120),
            }
            for i in range(1, 7)
        ]
        banquet_tables = [
            {
                "label": f"BQ{i}",
                "capacity": 10,
                "table_type": TableType.TABLE,
                "shape": TableShape.ROUND,
                "x": float(100 + ((i - 1) % 5) * 140),
                "y": float(100 + ((i - 1) // 5) * 140),
            }
            for i in range(1, 11)
        ]

        areas.extend(
            [
                {
                    "name": "Lobby Café",
                    "area_type": AreaType.DINING,
                    "sections": [{"name": "Lobby Seating", "tables": lobby_tables}],
                },
                {
                    "name": "Rooftop Restaurant",
                    "area_type": AreaType.OUTDOOR,
                    "sections": [{"name": "Rooftop Terrace", "tables": rooftop_tables}],
                },
                {
                    "name": "Grand Banquet",
                    "area_type": AreaType.BANQUET,
                    "sections": [{"name": "Banquet Hall", "tables": banquet_tables}],
                },
            ]
        )
        counters = []

    elif key == "counters":
        # params: count 1-12 and names; creates counter areas, no tables, for tokens
        count = int(params.get("count", 2))
        if count < 1 or count > 12:
            raise BusinessRuleError(
                "INVALID_TEMPLATE_PARAMS",
                "Counter count must be between 1 and 12.",
                status_code=400,
            )

        custom_names = params.get("names", [])
        if not isinstance(custom_names, list):
            custom_names = []

        counter_names: list[str] = []
        for i in range(1, count + 1):
            if i - 1 < len(custom_names) and str(custom_names[i - 1]).strip():
                counter_names.append(str(custom_names[i - 1]).strip())
            else:
                counter_names.append(f"Counter {i}")

        # Creates counter areas, NO tables!
        areas = [
            {
                "name": name,
                "area_type": AreaType.TAKEAWAY,
                "sections": [],
            }
            for name in counter_names
        ]
        counters = [{"name": name, "prefix": f"C{i}-"} for i, name in enumerate(counter_names, 1)]

    elif key == "empty":
        # 1 starter area and 1 section, 0 tables
        areas = [
            {
                "name": "Main Dining Area",
                "area_type": AreaType.DINING,
                "sections": [{"name": "Main Section", "tables": []}],
            }
        ]
        counters = []
    else:
        raise BusinessRuleError(
            "TEMPLATE_NOT_FOUND", f"Layout template '{key}' not found.", status_code=404
        )

    # Compute summary
    total_sections = sum(len(a.get("sections", [])) for a in areas)
    total_tables = sum(sum(len(s.get("tables", [])) for s in a.get("sections", [])) for a in areas)

    return {
        "key": key,
        "areas": areas,
        "token_counters": counters,
        "summary": {
            "areas_count": len(areas),
            "sections_count": total_sections,
            "tables_count": total_tables,
            "counters_count": len(counters),
        },
    }
