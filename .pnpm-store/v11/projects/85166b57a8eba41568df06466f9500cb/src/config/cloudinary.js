import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

export const hasCloudinary =
  Boolean(env.CLOUDINARY_CLOUD_NAME) &&
  Boolean(env.CLOUDINARY_API_KEY) &&
  Boolean(env.CLOUDINARY_API_SECRET);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export { cloudinary };

