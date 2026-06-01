const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001';

async function runTests() {
  console.log('=== INSTABUILD SYSTEM VERIFICATION ===\n');

  let testUserToken = null;
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Test User';

  // 1. Check if server is running
  try {
    const statusRes = await fetch(`${API_BASE}/status`);
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      console.log('✅ Runner Status endpoint: OK');
      console.log(`   Running: ${statusData.running}, Port: ${statusData.port}`);
    } else {
      console.log('❌ Runner Status endpoint: Failed', statusRes.status);
    }
  } catch (err) {
    console.error('❌ Failed to reach Runner server. Is it running on port 3001?', err.message);
    process.exit(1);
  }

  // 2. Auth Flow: Signup
  try {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName, email: testEmail, password: testPassword })
    });
    const data = await res.json();
    if (res.ok && data.success && data.token) {
      testUserToken = data.token;
      console.log('✅ Auth Signup endpoint: OK');
    } else {
      console.log('❌ Auth Signup endpoint: Failed', data);
    }
  } catch (err) {
    console.error('❌ Auth Signup error:', err.message);
  }

  // 3. Auth Flow: Login
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const data = await res.json();
    if (res.ok && data.success && data.token) {
      console.log('✅ Auth Login endpoint: OK');
    } else {
      console.log('❌ Auth Login endpoint: Failed', data);
    }
  } catch (err) {
    console.error('❌ Auth Login error:', err.message);
  }

  // 4. Auth Flow: Fetch Profile (/api/auth/me)
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${testUserToken}` }
    });
    const data = await res.json();
    if (res.ok && data.user) {
      console.log(`✅ Auth Profile (/api/auth/me): OK (User: ${data.user.name})`);
    } else {
      console.log('❌ Auth Profile endpoint: Failed', data);
    }
  } catch (err) {
    console.error('❌ Auth Profile error:', err.message);
  }

  // 5. Project Flow: Create Project
  let projectId = null;
  try {
    const res = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUserToken}`
      },
      body: JSON.stringify({
        name: 'Test Verification Project',
        idea: 'Verifying all backend features of InstaBuild',
        frontend: '<html><body><h1>Hello World</h1></body></html>',
        backend: 'console.log("hello");',
        business: 'Business details',
        pitch: 'Pitch deck details',
        landing: 'Landing page html',
        timestamp: new Date().toISOString()
      })
    });
    const data = await res.json();
    if (res.ok && data.success && data.project) {
      projectId = data.project._id || data.project.id;
      console.log(`✅ Project Creation endpoint: OK (ID: ${projectId})`);
    } else {
      console.log('❌ Project Creation endpoint: Failed', data);
    }
  } catch (err) {
    console.error('❌ Project Creation error:', err.message);
  }

  // 6. Project Flow: List Projects
  try {
    const res = await fetch(`${API_BASE}/api/projects`, {
      headers: { 'Authorization': `Bearer ${testUserToken}` }
    });
    const data = await res.json();
    if (res.ok && Array.isArray(data.projects)) {
      console.log(`✅ Project Listing endpoint: OK (${data.projects.length} project(s) found)`);
    } else {
      console.log('❌ Project Listing endpoint: Failed', data);
    }
  } catch (err) {
    console.error('❌ Project Listing error:', err.message);
  }

  // 7. Project Flow: Delete Project
  if (projectId) {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${testUserToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        console.log('✅ Project Deletion endpoint: OK');
      } else {
        console.log('❌ Project Deletion endpoint: Failed', data);
      }
    } catch (err) {
      console.error('❌ Project Deletion error:', err.message);
    }
  }

  // 8. Reviews Flow: Submit Review
  try {
    const res = await fetch(`${API_BASE}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUserToken}`
      },
      body: JSON.stringify({
        appId: 'instabuild',
        rating: 5,
        text: 'InstaBuild is amazing! Automated system validation test.'
      })
    });
    const data = await res.json();
    if (res.ok && data.success && data.review) {
      console.log('✅ Review Submission endpoint: OK');
    } else {
      console.log('❌ Review Submission endpoint: Failed', data);
    }
  } catch (err) {
    console.error('❌ Review Submission error:', err.message);
  }

  // 9. Reviews Flow: List Reviews
  try {
    const res = await fetch(`${API_BASE}/api/reviews`);
    const data = await res.json();
    if (res.ok && Array.isArray(data.reviews)) {
      console.log(`✅ Reviews Listing endpoint: OK (${data.reviews.length} reviews found)`);
      // Verify that at least one review matches our user and check fields
      const mine = data.reviews.find(r => r.text.includes('Automated system validation test'));
      if (mine) {
        console.log(`   Found submitted review: rating=${mine.rating}, userName=${mine.userName}, userEmail=${mine.userEmail}`);
      }
    } else {
      console.log('❌ Reviews Listing endpoint: Failed', data);
    }
  } catch (err) {
    console.error('❌ Reviews Listing error:', err.message);
  }

  // 10. AI Status check
  try {
    const res = await fetch(`${API_BASE}/api/ai/status`);
    const data = await res.json();
    if (res.ok && data.providers) {
      console.log('✅ AI Status endpoint: OK');
      data.providers.forEach(p => {
        console.log(`   - Provider: ${p.label} (${p.name}), Configured: ${p.configured}`);
      });
    } else {
      console.log('❌ AI Status endpoint: Failed', data);
    }
  } catch (err) {
    console.error('❌ AI Status check error:', err.message);
  }

  console.log('\n=== VERIFICATION COMPLETED ===');
}

runTests();
