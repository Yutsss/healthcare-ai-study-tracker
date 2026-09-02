#!/usr/bin/env node
/**
 * Backend API Test Suite for Yuta's Lab
 * Tests all API endpoints and Supabase RLS/triggers
 */

import { createClient } from '@supabase/supabase-js';

// Configuration from .env
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://learning-tracker-ai-1.preview.emergentagent.com';
const API_BASE = `${BASE_URL}/api`;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tddbnnghpsrlctvpqpel.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ii0II0Q_tGc-hXCILIbtKQ_Ots-rCGU';

// Test credentials
const OWNER_EMAIL = 'adyuta123@gmail.com';
const OWNER_PASSWORD = 'Yuta3216548844*';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
}

async function makeRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, data, ok: response.ok };
  } catch (error) {
    return { status: 0, data: null, ok: false, error: error.message };
  }
}

async function testHealthEndpoint() {
  console.log('\n=== Testing GET /api/health ===');
  const { status, data } = await makeRequest('/health');
  
  const passed = status === 200 && 
                 data?.ok === true && 
                 data?.supabaseConfigured === true && 
                 data?.adminConfigured === true;
  
  logTest('GET /api/health', passed, 
    passed ? `Response: ${JSON.stringify(data)}` : `Expected 200 with ok:true, got ${status}: ${JSON.stringify(data)}`);
  
  return passed;
}

async function testOwnerExists() {
  console.log('\n=== Testing GET /api/auth/owner-exists ===');
  const { status, data } = await makeRequest('/auth/owner-exists');
  
  const passed = status === 200 && 
                 data?.exists === true && 
                 data?.configured === true;
  
  logTest('GET /api/auth/owner-exists', passed,
    passed ? `Response: ${JSON.stringify(data)}` : `Expected 200 with exists:true, got ${status}: ${JSON.stringify(data)}`);
  
  return passed;
}

async function testRegisterOwnerBlocked() {
  console.log('\n=== Testing POST /api/auth/register-owner (should be blocked) ===');
  
  // Test 1: Try to create a second owner (should fail with 403)
  const { status, data } = await makeRequest('/auth/register-owner', {
    method: 'POST',
    body: JSON.stringify({
      email: 'other@example.com',
      password: 'Password123!'
    })
  });
  
  const passed1 = status === 403 && 
                  data?.error?.toLowerCase().includes('owner account already exists');
  
  logTest('POST /api/auth/register-owner - reject second owner', passed1,
    passed1 ? `Correctly rejected with 403: ${data.error}` : `Expected 403 with "owner already exists", got ${status}: ${JSON.stringify(data)}`);
  
  // Test 2: Bad email validation
  const { status: status2, data: data2 } = await makeRequest('/auth/register-owner', {
    method: 'POST',
    body: JSON.stringify({
      email: 'bademail',
      password: 'Password123!'
    })
  });
  
  const passed2 = status2 === 400 && data2?.error?.toLowerCase().includes('email');
  
  logTest('POST /api/auth/register-owner - bad email validation', passed2,
    passed2 ? `Correctly rejected bad email with 400` : `Expected 400 for bad email, got ${status2}: ${JSON.stringify(data2)}`);
  
  // Test 3: Short password validation
  const { status: status3, data: data3 } = await makeRequest('/auth/register-owner', {
    method: 'POST',
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'short'
    })
  });
  
  const passed3 = status3 === 400 && data3?.error?.toLowerCase().includes('password');
  
  logTest('POST /api/auth/register-owner - short password validation', passed3,
    passed3 ? `Correctly rejected short password with 400` : `Expected 400 for short password, got ${status3}: ${JSON.stringify(data3)}`);
  
  return passed1 && passed2 && passed3;
}

async function getAccessToken() {
  console.log('\n=== Authenticating with Supabase ===');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD
    });
    
    if (error) {
      console.error('❌ Authentication failed:', error.message);
      logTest('Supabase authentication', false, error.message);
      return null;
    }
    
    if (!data.session?.access_token) {
      console.error('❌ No access token in response');
      logTest('Supabase authentication', false, 'No access token received');
      return null;
    }
    
    console.log('✅ Successfully authenticated');
    console.log(`   User ID: ${data.user.id}`);
    logTest('Supabase authentication', true, `User ID: ${data.user.id}`);
    
    return { token: data.session.access_token, userId: data.user.id, supabase };
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    logTest('Supabase authentication', false, error.message);
    return null;
  }
}

async function testSeedPreview(token) {
  console.log('\n=== Testing GET /api/seed/preview ===');
  
  // Test without auth (should fail)
  const { status: status1, data: data1 } = await makeRequest('/seed/preview');
  const passed1 = status1 === 401;
  logTest('GET /api/seed/preview - without auth', passed1,
    passed1 ? 'Correctly rejected with 401' : `Expected 401, got ${status1}`);
  
  // Test with auth (should succeed)
  const { status, data } = await makeRequest('/seed/preview', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const passed2 = status === 200 && 
                  data?.dryRun === true &&
                  data?.roadmap_items?.total === 14 &&
                  data?.course_units?.total === 58 &&
                  data?.modules?.total === 265 &&
                  data?.milestones?.total === 4 &&
                  data?.projects?.total === 1;
  
  // Check that since data is already imported, inserted should be 0 and updated should equal total
  const passed3 = data?.roadmap_items?.inserted === 0 && 
                  data?.roadmap_items?.updated === 14 &&
                  data?.course_units?.inserted === 0 &&
                  data?.course_units?.updated === 58 &&
                  data?.modules?.inserted === 0 &&
                  data?.modules?.updated === 265;
  
  logTest('GET /api/seed/preview - with auth', passed2 && passed3,
    passed2 && passed3 ? `Correct counts: 14 roadmap_items, 58 course_units, 265 modules, 4 milestones, 1 projects. Inserted: 0, Updated: totals (idempotent)` : 
    `Expected specific counts with inserted=0, got ${status}: ${JSON.stringify(data)}`);
  
  return passed1 && passed2 && passed3;
}

async function testSeedImport(token) {
  console.log('\n=== Testing POST /api/seed/import ===');
  
  // Test without auth (should fail)
  const { status: status1, data: data1 } = await makeRequest('/seed/import', {
    method: 'POST',
    body: JSON.stringify({})
  });
  const passed1 = status1 === 401;
  logTest('POST /api/seed/import - without auth', passed1,
    passed1 ? 'Correctly rejected with 401' : `Expected 401, got ${status1}`);
  
  // Test with auth (should succeed, idempotent)
  const { status, data } = await makeRequest('/seed/import', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({})
  });
  
  const passed2 = status === 200 && 
                  data?.roadmap_items?.inserted === 0 &&
                  data?.roadmap_items?.updated === 14 &&
                  data?.course_units?.updated === 58 &&
                  data?.modules?.updated === 265;
  
  logTest('POST /api/seed/import - with auth (idempotent)', passed2,
    passed2 ? `Idempotent import: inserted=0, updated=totals` : 
    `Expected 200 with inserted=0, got ${status}: ${JSON.stringify(data)}`);
  
  return passed1 && passed2;
}

async function testSeedStatus(token) {
  console.log('\n=== Testing GET /api/seed/status ===');
  
  // Test without auth (should fail)
  const { status: status1, data: data1 } = await makeRequest('/seed/status');
  const passed1 = status1 === 401;
  logTest('GET /api/seed/status - without auth', passed1,
    passed1 ? 'Correctly rejected with 401' : `Expected 401, got ${status1}`);
  
  // Test with auth (should succeed)
  const { status, data } = await makeRequest('/seed/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const passed2 = status === 200 && 
                  data?.counts?.roadmap_items === 14 &&
                  data?.counts?.course_units === 58 &&
                  data?.counts?.modules === 265 &&
                  data?.counts?.milestones === 4 &&
                  data?.counts?.projects === 1;
  
  logTest('GET /api/seed/status - with auth', passed2,
    passed2 ? `Correct counts: ${JSON.stringify(data.counts)}` : 
    `Expected specific counts, got ${status}: ${JSON.stringify(data)}`);
  
  return passed1 && passed2;
}

async function testUnknownPath() {
  console.log('\n=== Testing unknown path ===');
  const { status, data } = await makeRequest('/nope');
  
  const passed = status === 404;
  logTest('GET /api/nope - unknown path', passed,
    passed ? 'Correctly returned 404' : `Expected 404, got ${status}: ${JSON.stringify(data)}`);
  
  return passed;
}

async function testDirectSupabase(supabase, userId) {
  console.log('\n=== Testing Direct Supabase (RLS + Triggers) ===');
  
  // Test 8a: Select modules (should see 265 rows)
  console.log('\n--- Test 8a: Select modules ---');
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select('*');
  
  const passed8a = !modulesError && modules && modules.length === 265;
  logTest('Direct Supabase - select modules', passed8a,
    passed8a ? `Retrieved ${modules.length} modules` : 
    `Expected 265 modules, got ${modules?.length || 0}. Error: ${modulesError?.message || 'none'}`);
  
  // Test 8b: Upsert module_progress and verify XP trigger
  console.log('\n--- Test 8b: Upsert module_progress + XP trigger ---');
  
  // First, get the module ID for 'module-002'
  const { data: targetModule, error: moduleError } = await supabase
    .from('modules')
    .select('id')
    .eq('key', 'module-002')
    .single();
  
  if (moduleError || !targetModule) {
    logTest('Direct Supabase - find module-002', false, `Could not find module-002: ${moduleError?.message}`);
    return false;
  }
  
  const moduleId = targetModule.id;
  console.log(`   Found module-002 with ID: ${moduleId}`);
  
  // Upsert module_progress to 'done'
  const { error: upsertError } = await supabase
    .from('module_progress')
    .upsert({
      owner_id: userId,
      module_id: moduleId,
      status: 'done'
    }, {
      onConflict: 'owner_id,module_id'
    });
  
  if (upsertError) {
    logTest('Direct Supabase - upsert module_progress to done', false, upsertError.message);
    return false;
  }
  
  console.log('   ✅ Upserted module_progress to done');
  
  // Wait a bit for trigger to fire
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check XP events for this module
  const { data: xpEvents, error: xpError } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'module')
    .eq('source_id', moduleId)
    .eq('owner_id', userId);
  
  const passed8b1 = !xpError && xpEvents && xpEvents.length > 0 && xpEvents[0].amount === 20;
  logTest('Direct Supabase - XP event created (20 XP)', passed8b1,
    passed8b1 ? `XP event found: ${xpEvents[0].amount} XP` : 
    `Expected XP event with 20 XP, got ${xpEvents?.length || 0} events. Error: ${xpError?.message || 'none'}`);
  
  // Check activity events
  const { data: activityEvents, error: activityError } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'module_completed')
    .eq('entity_type', 'module')
    .eq('entity_id', moduleId)
    .eq('owner_id', userId);
  
  const passed8b2 = !activityError && activityEvents && activityEvents.length > 0;
  logTest('Direct Supabase - activity event created', passed8b2,
    passed8b2 ? `Activity event found: ${activityEvents.length} events` : 
    `Expected activity event, got ${activityEvents?.length || 0} events. Error: ${activityError?.message || 'none'}`);
  
  // Test idempotency: set to done again (should NOT create duplicate XP)
  const xpCountBefore = xpEvents?.length || 0;
  
  const { error: upsertError2 } = await supabase
    .from('module_progress')
    .upsert({
      owner_id: userId,
      module_id: moduleId,
      status: 'done'
    }, {
      onConflict: 'owner_id,module_id'
    });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const { data: xpEvents2, error: xpError2 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'module')
    .eq('source_id', moduleId)
    .eq('owner_id', userId);
  
  const passed8b3 = xpEvents2 && xpEvents2.length === xpCountBefore;
  logTest('Direct Supabase - XP trigger idempotent', passed8b3,
    passed8b3 ? `XP count unchanged: ${xpEvents2.length}` : 
    `Expected ${xpCountBefore} XP events, got ${xpEvents2?.length || 0}`);
  
  // Clean up: set back to not_started
  await supabase
    .from('module_progress')
    .upsert({
      owner_id: userId,
      module_id: moduleId,
      status: 'not_started'
    }, {
      onConflict: 'owner_id,module_id'
    });
  
  console.log('   ✅ Cleaned up: set module_progress back to not_started');
  
  // Test 8c: Try to insert with spoofed owner_id (should fail with RLS)
  console.log('\n--- Test 8c: RLS blocks spoofed owner_id ---');
  const { error: rlsError } = await supabase
    .from('module_progress')
    .insert({
      owner_id: '00000000-0000-0000-0000-000000000000',
      module_id: moduleId,
      status: 'done'
    });
  
  const passed8c = rlsError && (rlsError.code === '42501' || rlsError.message.includes('permission') || rlsError.message.includes('policy'));
  logTest('Direct Supabase - RLS blocks spoofed owner_id', passed8c,
    passed8c ? `RLS correctly blocked: ${rlsError.message}` : 
    `Expected RLS error (42501), got: ${rlsError?.message || 'no error (SECURITY ISSUE!)'}`);
  
  // Test 8d: Anonymous client cannot read modules
  console.log('\n--- Test 8d: Anonymous client blocked ---');
  const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  const { data: anonModules, error: anonError } = await anonClient
    .from('modules')
    .select('*');
  
  const passed8d = (anonError && anonError.message.includes('permission')) || 
                   (anonModules && anonModules.length === 0);
  logTest('Direct Supabase - anonymous client blocked', passed8d,
    passed8d ? `Anonymous access blocked: ${anonError?.message || '0 rows returned'}` : 
    `Expected permission error or 0 rows, got ${anonModules?.length || 0} rows`);
  
  return passed8a && passed8b1 && passed8b2 && passed8b3 && passed8c && passed8d;
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Yuta\'s Lab Backend API Test Suite                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`API Base: ${API_BASE}`);
  console.log(`Supabase: ${SUPABASE_URL}\n`);
  
  try {
    // Test public endpoints
    await testHealthEndpoint();
    await testOwnerExists();
    await testRegisterOwnerBlocked();
    await testUnknownPath();
    
    // Get authentication token
    const auth = await getAccessToken();
    if (!auth) {
      console.error('\n❌ Cannot proceed with protected endpoint tests - authentication failed');
      return;
    }
    
    const { token, userId, supabase } = auth;
    
    // Test protected endpoints
    await testSeedPreview(token);
    await testSeedImport(token);
    await testSeedStatus(token);
    
    // Test direct Supabase operations
    await testDirectSupabase(supabase, userId);
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    logTest('Test suite execution', false, error.message);
  }
  
  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nTotal Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%\n`);
  
  if (results.failed > 0) {
    console.log('Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  ❌ ${t.name}`);
      if (t.details) console.log(`     ${t.details}`);
    });
  }
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
