from django.db import models


class FoodType(models.TextChoices):
    VEG = "VEG", "Vegetarian"
    NON_VEG = "NON_VEG", "Non-Vegetarian"
    EGG = "EGG", "Contains Egg"


ALLOWED_IMAGE_MIMES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB max raw upload
MAX_IMAGE_DIMENSION = 2000
MIN_IMAGE_WIDTH = 400
MIN_IMAGE_HEIGHT = 300
CARD_IMAGE_SIZE = (800, 600)
THUMB_IMAGE_SIZE = (300, 300)
