import { GoogleGenerativeAI } from "@google/generative-ai";
import puppeteer from "puppeteer";
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- 1. Web Scraper using Puppeteer ---
async function scrapeTextFromUrl(url) {
  let browser = null;
  try {
    console.log(`Launching headless browser to scrape: ${url}`);
    browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle0", timeout: 35000 });
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log(`Successfully scraped ${textContent.length} characters.`);
    return textContent.replace(/\s\s+/g, " ").trim().slice(0, 8000);
  } catch (error) {
    console.error(`Puppeteer scraping failed for URL: ${url}`, error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// --- 2. AI Analysis Logic ---
export async function analyzeUrlContent(url) {
  const text = await scrapeTextFromUrl(url);

  if (!text || text.length < 50) {
    console.log("Not enough meaningful content to analyze from the URL.");
    return {
      summary: "Could not extract sufficient text content from this URL.",
      tags: [],
      safety: {
        safety_rating: 3,
        justification:
          "Unable to analyze the content. The page may be an image, a login wall, or a complex application.",
      },
    };
  }

  // --- THIS IS THE FIX ---
  // The model name has been updated to the latest stable and efficient version.
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const summaryPrompt = `You are an assistant that summarizes the content of webpages. 
    The following text is the scraped content from a given URL. 
    Task:
    1. Identify the main purpose of the webpage.  
    2. Provide a concise summary of the key information.  
    3. Highlight important entities (people, companies, products, dates, numbers, links, etc.) if available.  
    4. If the page is an article, summarize it in 3–5 sentences.  
    5. If the page is a product/service page, summarize what it offers, its features, and any pricing or benefits.  
    6. Ignore navigation menus, ads, and irrelevant text.  
    7. Keep the summary clear and non-verbose (max 150 words).  
    8. Extract up to 5 relevant keywords as a JSON array.
    9. Do not hallucinate — only base your summary on the provided content.
    Your response must be a single valid JSON object with keys "summary" and "tags".
    Return your output ONLY as a valid JSON object, nothing else. 
    Do not include explanations or extra text outside the JSON. 

    JSON schema:
    {
      "summary": "string, concise summary of the webpage (max 150 words)",
      "tags": ["string", "string", ...] // up to 5 keywords
    }
    Text: "${text}"`;

  // Safety and classification prompts
  const safetyPrompt = `You are a security and safety auditor for web content.
  The following text is the scraped content from a given URL. 

  Task:
    1. Check if the page contains any harmful, malicious, or unsafe content (e.g., phishing attempts, malware links, scams, explicit/abusive material, misinformation, illegal activities).  
    2. If you see ANY keywords related to malware, viruses, exploits, trojans, or malicious software, you MUST lower the safety rating significantly (to 2 or below).
    3 It does NOT matter if the context says it's a "test" or "safe." The presence of these keywords is a major red flag.
    4 Be highly suspicious of any page that offers file downloads.
    5. Detect suspicious patterns such as repeated download prompts, requests for personal information, or unusual redirects.  
    6. Rate the overall safety level of the website on a scale of 1–5:
      - 1 = Very Unsafe (likely harmful or malicious)
      - 2 = Unsafe (some clear red flags)
      - 3 = Neutral (mixed, unclear, needs caution)
      - 4 = Mostly Safe (no obvious risks, but not authoritative)
      - 5 = Safe (legitimate, trustworthy, no red flags detected)
      7. Explain briefly why you gave this rating (max 3 sentences).  
      8. Do not hallucinate — only base your analysis on the provided content.  
    Return your output ONLY as a valid JSON object, nothing else. 
    Do not include explanations or extra text outside the JSON. 
    JSON schema:
    {
      "safety_rating": 1-5,
      "explanation": "string";
    }
    Here is the scraped content from the URL: "${text}"`;

  const classificationPrompt = `
      You are a web content classifier. 
      Your job is to analyze scraped webpage content and classify it into a predefined category.

      Categories:
      - Programming/Tech Blog
      - Documentation/Reference
      - Research/Academic
      - News/Current Affairs
      - Learning/Education
      - Product/Service Page
      - E-commerce/Marketplace
      - Social Media/Forum
      - Entertainment/Media
      - Scam/Phishing/Unsafe
      - Other
      Return your output ONLY as a valid JSON object, nothing else. 
      Do not include explanations or extra text outside the JSON. 
      JSON schema:
      {
        "category": "one of the categories above",
        "confidence": "number between 0 and 1 indicating confidence level",
        "reason": "brief explanation of why this category was chosen"
      }
      Here is the scraped text:
      """${text}"""
      `;

  try {
    const [summaryResult, safetyResult, classificationResult] =
      await Promise.all([
        model.generateContent(summaryPrompt),
        model.generateContent(safetyPrompt),
        model.generateContent(classificationPrompt),
      ]);

    const summaryText = summaryResult.response
      .text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const safetyText = safetyResult.response
      .text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const categoryResult = classificationResult.response
      .text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const summary = JSON.parse(summaryText);
    const safety = JSON.parse(safetyText);
    const classification = JSON.parse(categoryResult);

    return {
      summary: summary.summary,
      tags: summary.tags,
      safety,
      classification,
    };
  } catch (error) {
    console.error("Error parsing AI response:", error);
    throw new Error("Failed to get a valid response from the AI model.");
  }
}
