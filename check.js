import { chromium } from "playwright";
import nodemailer from "nodemailer";
import fs from "fs";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const YOUR_PHONE_EMAIL = process.env.YOUR_PHONE_EMAIL;

const SEEN_FILE = "seen-status.json";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

async function sendText(message) {
  await transporter.sendMail({
    from: GMAIL_USER,
    to: YOUR_PHONE_EMAIL,
    subject: "BestBuy",
    text: message,
  });
}

function loadSeen() {
  if (!fs.existsSync(SEEN_FILE)) return { stores: [] };
  return JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"));
}

function saveSeen(data) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(data, null, 2));
}

async function checkStock() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();

  console.log("Checking Best Buy...");

  // ✅ FIX 1: go to PRODUCT PAGE (not cart)
  await page.goto("https://www.bestbuy.com/site/6665825.p?skuId=6665825", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await page.waitForTimeout(4000);

  // ✅ FIX 2: try to open store selector
  try {
    await page
      .locator(
        'button:has-text("Check nearby stores"), button:has-text("Find stores"), button:has-text("Change store")'
      )
      .first()
      .click({ timeout: 8000 });

    console.log("Opened store selector");
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log("Could not open store selector");
  }

  // ✅ FIX 3: set ZIP manually
  try {
    const zipInput = page.locator('input[placeholder*="ZIP"], input[type="search"]').first();
    await zipInput.fill("85008");
    await page.keyboard.press("Enter");
    console.log("Entered ZIP 85008");
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log("Could not set ZIP");
  }

  const text = await page.textContent("body");

  console.log("DEBUG TEXT:");
  console.log(text.slice(0, 1500));

  const allAZStores = [
    "Camelback",
    "Tempe Marketplace",
    "Ahwatukee",
    "Thunderbird Rd.",
    "North Scottsdale",
    "Chandler",
    "Avondale",
    "Arrowhead",
    "Superstition Springs",
    "Gilbert",
    "Goodyear",
    "Phoenix Warehouse",
    "Surprise",
    "Prescott",
    "Tucson",
  ];

  let stores = allAZStores.filter((store) => {
    const index = text.indexOf(store);
    if (index === -1) return false;

    const nearbyText = text.slice(index, index + 1200);

    return (
      nearbyText.includes("Available for pickup") ||
      nearbyText.includes("Ready for pickup") ||
      nearbyText.includes("Available today") ||
      nearbyText.includes("Pickup available")
    );
  });

  stores = [...new Set(stores)];

  const seen = loadSeen();
  const oldStores = seen.stores || [];
  const newStores = stores.filter((s) => !oldStores.includes(s));

  if (newStores.length > 0) {
    console.log("NEW STORES:", newStores);

    await sendText(
      "Best Buy SKU 6665825 available at:\n" + newStores.join("\n")
    );

    saveSeen({ stores });
  } else if (stores.length > 0) {
    console.log("Still available at:", stores);
    saveSeen({ stores });
  } else {
    console.log("No AZ stores found.");
    saveSeen({ stores: [] });
  }

  await browser.close();
}

checkStock()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.log("Check failed:");
    console.log(err.message);
    process.exit(1);
  });
