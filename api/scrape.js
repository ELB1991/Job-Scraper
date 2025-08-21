import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

/**
 * Vercel Serverless Function
 * GET /api/scrape?url=https://...
 * Returns: { url, title, text, status }
 */
export default async function handler(req, res) {
  try {
    const target = req.query.url;
    if (!target) {
      return res.status(400).json({ error: "Missing url parameter ?url=" });
    }

    // Basic allowlist to avoid SSRF issues
    const blocked = [/^http:\/\/|^file:|@/i];
    if (blocked.some(rx => rx.test(target))) {
      return res.status(400).json({ error: "URL scheme not allowed." });
    }

    // Fetch page
    const resp = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        "Accept-Language": "de,en;q=0.9"
      },
      redirect: "follow"
    });

    const html = await resp.text();

    // Parse with JSDOM + Readability to get main article text
    const dom = new JSDOM(html, { url: target });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const title = article?.title || dom.window.document.title || "";
    const text = article?.textContent
      ?.replace(/\n{3,}/g, "\n\n")
      ?.trim() || "";

    // Fallback: if nothing extracted, return raw <body> text
    let outText = text;
    if (!outText) {
      outText =
        dom.window.document.body?.textContent
          ?.replace(/\s+\n/g, "\n")
          ?.replace(/\n{3,}/g, "\n\n")
          ?.trim() || "";
    }

    return res.status(200).json({
      url: target,
      title,
      text: outText.slice(0, 250000), // safety limit
      status: resp.status
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
