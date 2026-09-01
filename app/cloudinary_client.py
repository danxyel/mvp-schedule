"""Configuración de Cloudinary para almacenamiento de logos por tenant.

La variable CLOUDINARY_URL (cloudinary://api_key:api_secret@cloud_name)
se lee del entorno. Si falta, los endpoints de logo devolverán un error
controlado en vez de fallar al importar.
"""

import os

import cloudinary
from cloudinary import uploader

cloudinary.config(cloudinary_url=os.getenv("CLOUDINARY_URL"))

__all__ = ["cloudinary", "uploader"]
