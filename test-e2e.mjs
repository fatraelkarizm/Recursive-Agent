// Quick e2e test - run with: node test-e2e.mjs
const BACKEND_URL = "http://localhost:4000";

async function testMissionCreation() {
  console.log("🧪 E2E Test: Mission Creation Flow\n");
  
  // Test 1: Health check
  console.log("1️⃣ Testing backend health...");
  try {
    const healthRes = await fetch(`${BACKEND_URL}/health`);
    if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
    console.log("✅ Backend healthy\n");
  } catch (err) {
    console.error("❌ Backend unreachable:", err.message);
    process.exit(1);
  }
  
  // Test 2: Create scraper mission
  console.log("2️⃣ Testing scraper agent generation...");
  const scraperRes = await fetch(`${BACKEND_URL}/api/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Create an AI that scrapes Reddit for data" })
  });
  const scraperData = await scraperRes.json();
  console.log(`✅ Generated: ${scraperData.profile.name} (${scraperData.profile.role})\n`);
  
  // Test 3: Create coding mission
  console.log("3️⃣ Testing coding agent generation...");
  const codingRes = await fetch(`${BACKEND_URL}/api/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Debug this Python code and fix the bug" })
  });
  const codingData = await codingRes.json();
  console.log(`✅ Generated: ${codingData.profile.name} (${codingData.profile.role})\n`);
  
  // Test 4: Create recommendation mission
  console.log("4️⃣ Testing recommendation agent generation...");
  const recRes = await fetch(`${BACKEND_URL}/api/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Suggest the best movies for a user who likes sci-fi" })
  });
  const recData = await recRes.json();
  console.log(`✅ Generated: ${recData.profile.name} (${recData.profile.role})\n`);
  
  console.log("🎉 All tests passed! Backend is working correctly.");
}

testMissionCreation().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
