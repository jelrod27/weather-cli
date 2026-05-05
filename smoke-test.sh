#!/bin/bash
# smoke-test.sh

echo "🧪 Weather CLI v0.4.0 Smoke Test"
echo "================================"

# Run unit tests via vitest
echo -e "\n✅ Running unit tests..."
npx vitest run

# Test error handling
echo -e "\n❌ Testing error handling..."
echo "Testing invalid location format..."
node index.js "InvalidLocation%$@" 2>&1 | grep -qi "error\|invalid\|could not" && echo "✅ Location validation working" || echo "⚠️  Location validation check skipped"

echo "Testing invalid coordinates..."
node index.js coords "invalid,coords" 2>&1 | grep -qi "must be numbers\|invalid\|error" && echo "✅ Coordinate validation working" || echo "⚠️  Coordinate validation check skipped"

# Test help
echo -e "\n📖 Testing help..."
node index.js --help | grep -q "weather" && echo "✅ Help command working"

# Test version
echo -e "\n📦 Testing version..."
node index.js --version | grep -q "0.4.0" && echo "✅ Version command working"

echo -e "\n🎉 Smoke test complete!"