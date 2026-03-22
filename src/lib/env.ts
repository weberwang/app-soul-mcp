import "dotenv/config";
import path from "path";

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const env = {
  dribbbleAccessToken: optionalEnv("DRIBBBLE_ACCESS_TOKEN"),
  outputDir: optionalEnv("OUTPUT_DIR", path.join(process.cwd(), "output")),
};
