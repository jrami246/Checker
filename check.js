import { chromium } from "playwright";
import nodemailer from "nodemailer";
import fs from "fs";

const PRODUCT_URL = "https://www.bestbuy.com/site/6665825.p?skuId=6665825";

// change this to your phone SMS email
const YOUR_PHONE_EMAIL = "4803958191@txt.att.net";

// change these
const GMAIL_USER = "jackieramirez986@gmail.com";
const GMAIL_APP_PASSWORD = "agoyiqslsmrjeeps";

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
  if (!fs.existsSync(SEEN_FILE)) return { wasInStock: false };
  return JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"));
}

function saveSeen(data) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(data, null, 2));
}

async function checkStock() {
  const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});

const page = await browser.newPage();

  console.log("Checking Best Buy...");
await page.goto("https://www.bestbuy.com/cart", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await page.waitForTimeout(5000);

// click the pickup store shown in cart, like Surprise
try {
  const pickupStoreBtn = page
    .locator(
      'button:has-text("Surprise"), a:has-text("Surprise"), button:has-text("Pickup"), a:has-text("Pickup"), button:has-text("Change store"), a:has-text("Change store")'
    )
    .first();

  await pickupStoreBtn.click();
  console.log("Clicked pickup store/change store");
  await page.waitForTimeout(7000);
} catch (err) {
  console.log("Could not click pickup store:");
  console.log(err.message);
}

// read nearby stores popup/page
// read nearby stores popup/page
// read nearby stores popup/page
const text = await page.textContent("body");

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
  "Tucson"
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

  saveSeen({ wasInStock: true, stores });
} else if (stores.length > 0) {
  console.log("Still available at:", stores);
  saveSeen({ wasInStock: true, stores });
} else {
  console.log("No AZ stores found.");
  saveSeen({ wasInStock: false, stores: [] });

}
await context.close();
}

checkStock().catch((err) => {
  console.log("Check failed:");
  console.log(err.message);
});
