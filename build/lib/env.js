import "dotenv/config";
import path from "path";
function optionalEnv(key, fallback = "") {
    return process.env[key] ?? fallback;
}
export const env = {
    unsplashAccessKey: optionalEnv("UNSPLASH_ACCESS_KEY"),
    outputDir: optionalEnv("OUTPUT_DIR", path.join(process.cwd(), "output")),
};
//# sourceMappingURL=env.js.map