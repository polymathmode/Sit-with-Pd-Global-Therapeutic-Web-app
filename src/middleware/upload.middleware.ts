import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

// Storage for program thumbnails and camp images
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'wellbeing/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit' }],
  } as object,
});

// Storage for lesson videos
const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'wellbeing/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi'],
  } as object,
});

// Storage for lesson files (PDFs, documents)
const fileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'wellbeing/files',
    resource_type: 'raw',
    allowed_formats: ['pdf', 'docx', 'zip'],
  } as object,
});

// Combined storage for Add Lesson: routes 'video' → videos, 'file' → PDFs/documents
const lessonStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    if (file.fieldname === 'video') {
      return {
        folder: 'wellbeing/videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi'],
      } as object;
    }
    return {
      folder: 'wellbeing/files',
      resource_type: 'raw',
      allowed_formats: ['pdf', 'docx', 'zip'],
    } as object;
  },
});

export const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

export const uploadFile = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export const uploadLesson = multer({
  storage: lessonStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB for video, 50MB for file (Cloudinary enforces per-upload)
});
