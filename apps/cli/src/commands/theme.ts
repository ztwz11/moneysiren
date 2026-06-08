import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { CliExecutionContext } from "../cli.js";

const THEME_USAGE = "Usage: stackspend theme <preview|image-prompt|image-generate> [--out <png> --theme-out <json> --model <model>]";
const DEFAULT_IMAGE_MODEL = "gpt-image-1.5";
const DEFAULT_IMAGE_OUTPUT = ".stackspend/themes/cli-image-reference.png";
const DEFAULT_THEME_OUTPUT = ".stackspend/themes/cli-theme.json";

const IMAGE_PROMPT = `Create a polished Image 2 reference for the StackSpend CLI theme.

Product:
- StackSpend is a local-first cloud/SaaS usage, status, and expected billing dashboard for individual developers and small teams.
- CLI surfaces should feel operational, calm, high-trust, and dense enough for repeated terminal use.

Image direction:
- Show a modern terminal window with a StackSpend slash-command home screen, provider status rows, and small usage/risk indicators.
- Use a restrained professional palette with teal as the brand accent, graphite text, warm amber warnings, and clear green success states.
- Avoid marketing hero art, decorative blobs, oversized typography, and purple/blue gradient dominance.
- Make spacing comfortable enough that controls do not touch, overlap, or wrap awkwardly.

Return a visual reference plus this theme JSON shape:
{
  "version": 1,
  "source": "image2-dashboard",
  "ansi": {
    "brand": "1;38;5;30",
    "heading": "1;38;5;231",
    "command": "38;5;35",
    "muted": "38;5;244",
    "warning": "38;5;214"
  }
}

Apply the JSON locally with STACKSPEND_CLI_THEME_FILE=<path-to-json>.`;

export async function runThemeCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === undefined) {
    context.stderr(THEME_USAGE);
    return 1;
  }

  if (subcommand === "preview") {
    if (rest.length > 0) {
      context.stderr(THEME_USAGE);
      return 1;
    }

    context.stdout(renderThemePreview(context));
    return 0;
  }

  if (subcommand === "image-prompt") {
    if (rest.length > 0) {
      context.stderr(THEME_USAGE);
      return 1;
    }

    context.stdout(IMAGE_PROMPT);
    return 0;
  }

  if (subcommand === "image-generate") {
    return runImageGenerateCommand(rest, context);
  }

  context.stderr(THEME_USAGE);
  return 1;
}

function renderThemePreview(context: CliExecutionContext): string {
  const { theme } = context;

  return [
    `${theme.brand("StackSpend")} CLI theme`,
    `Source: ${theme.source}`,
    "",
    `${theme.heading("Heading")}  ${theme.command("/sync openai")}  ${theme.muted("muted metadata")}  ${theme.warning("warning")}`,
    "",
    "Set STACKSPEND_CLI_THEME=image2-dashboard for the bundled image-reference palette.",
    "Set STACKSPEND_CLI_THEME_FILE=<json> to apply a palette extracted from an image reference.",
  ].join("\n");
}

async function runImageGenerateCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const options = parseImageGenerateOptions(args, context.env);
  const apiKey = context.env.OPENAI_API_KEY?.trim();

  if (apiKey === undefined || apiKey.length === 0) {
    context.stderr("OpenAI image generation requires OPENAI_API_KEY. The key is only read from env and is not persisted.");
    return 1;
  }

  const response = await context.fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      prompt: IMAGE_PROMPT,
      n: 1,
      size: "1536x1024",
      quality: "low",
    }),
  });

  if (!response.ok) {
    context.stderr(`OpenAI image generation failed with status ${response.status}.`);
    return 1;
  }

  const payload = await response.json() as { data?: Array<{ b64_json?: unknown }> };
  const imageBase64 = payload.data?.[0]?.b64_json;

  if (typeof imageBase64 !== "string" || imageBase64.trim().length === 0) {
    context.stderr("OpenAI image generation response did not include image data.");
    return 1;
  }

  const imagePath = resolveCliPath(context.cwd, options.out);
  const themePath = resolveCliPath(context.cwd, options.themeOut);
  await writeLocalFile(imagePath, Buffer.from(imageBase64, "base64"));
  await writeLocalFile(themePath, Buffer.from(JSON.stringify(themeFileFor(options.model), null, 2), "utf8"));

  context.stdout("Generated StackSpend CLI image theme reference.");
  context.stdout(`Image: ${options.out}`);
  context.stdout(`Theme: ${options.themeOut}`);
  context.stdout(`Apply: STACKSPEND_CLI_THEME_FILE=${options.themeOut} stackspend theme preview`);
  return 0;
}

function parseImageGenerateOptions(
  args: readonly string[],
  env: Record<string, string | undefined>,
): { out: string; themeOut: string; model: string } {
  let out = DEFAULT_IMAGE_OUTPUT;
  let themeOut = DEFAULT_THEME_OUTPUT;
  let model = env.STACKSPEND_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    if (arg === "--out" && value !== undefined) {
      out = value;
      index += 1;
      continue;
    }

    if (arg === "--theme-out" && value !== undefined) {
      themeOut = value;
      index += 1;
      continue;
    }

    if (arg === "--model" && value !== undefined) {
      model = value;
      index += 1;
      continue;
    }

    throw new Error(THEME_USAGE);
  }

  return {
    out: requireNonBlankPath(out, "--out"),
    themeOut: requireNonBlankPath(themeOut, "--theme-out"),
    model: requireSafeModelName(model),
  };
}

function themeFileFor(model: string): {
  version: 1;
  source: string;
  ansi: Record<"brand" | "heading" | "command" | "muted" | "warning", string>;
} {
  return {
    version: 1,
    source: `image-generation:${model}`,
    ansi: {
      brand: "1;38;5;30",
      heading: "1;38;5;231",
      command: "38;5;35",
      muted: "38;5;244",
      warning: "38;5;214",
    },
  };
}

async function writeLocalFile(path: string, content: Buffer): Promise<void> {
  await mkdir(dirname(path), {
    recursive: true,
  });
  await writeFile(path, content);
}

function resolveCliPath(cwd: string, path: string): string {
  return isAbsolute(path) ? path : join(cwd, path);
}

function requireNonBlankPath(value: string, label: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} must not be blank.`);
  }

  return trimmed;
}

function requireSafeModelName(value: string): string {
  const trimmed = value.trim();

  if (!/^[A-Za-z0-9._-]{1,80}$/.test(trimmed)) {
    throw new Error("Image model name is invalid.");
  }

  return trimmed;
}
