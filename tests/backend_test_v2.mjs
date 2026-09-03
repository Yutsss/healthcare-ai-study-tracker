#!/usr/bin/env node
/**
 * Backend Test Suite v2 for Yuta's Lab
 * Tests new database behavior from migration 003_gamification_v2.sql
 * - study_logs insert/delete XP triggers
 * - exercise_reports delete cleanup
 * - achievement_definitions upsert + earned_achievements -> XP trigger
 * - milestone_roadmap_items (14 links) readable under RLS
 * - owner_settings weekly goal upsert
 * - RLS negative tests
 * - API smoke tests
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

// Track created IDs for cleanup
const cleanup = {
  studyLogIds: [],
  exerciseReportIds: [],
  achievementDefIds: [],
  earnedAchievementIds: []
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

async function getAuthenticatedClient() {
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

// Test 1: study_logs insert/delete XP triggers
async function testStudyLogs(supabase, userId) {
  console.log('\n=== Test 1: study_logs insert/delete XP triggers ===');
  
  // Test 1a: Insert with 45 minutes -> XP +5 (ceil(45/10))
  console.log('\n--- Test 1a: Insert study_log with 45 minutes ---');
  const today = new Date().toISOString().split('T')[0];
  
  const { data: log1, error: log1Error } = await supabase
    .from('study_logs')
    .insert({
      owner_id: userId,
      logged_on: today,
      minutes: 45,
      topic: 'test study session'
    })
    .select()
    .single();
  
  if (log1Error || !log1) {
    logTest('study_logs - insert 45 minutes', false, `Insert failed: ${log1Error?.message}`);
    return false;
  }
  
  cleanup.studyLogIds.push(log1.id);
  console.log(`   ✅ Inserted study_log ID: ${log1.id}`);
  
  // Wait for trigger
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check XP event (should be 5 XP: ceil(45/10))
  const { data: xpEvents1, error: xpError1 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'study_log')
    .eq('source_id', log1.id);
  
  const passed1a = !xpError1 && xpEvents1 && xpEvents1.length === 1 && xpEvents1[0].amount === 5;
  logTest('study_logs - 45 minutes -> 5 XP', passed1a,
    passed1a ? `XP event created: ${xpEvents1[0].amount} XP` : 
    `Expected 1 XP event with 5 XP, got ${xpEvents1?.length || 0} events with amount ${xpEvents1?.[0]?.amount || 'N/A'}`);
  
  // Check activity event
  const { data: activityEvents1, error: activityError1 } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'study_logged')
    .eq('entity_id', log1.id);
  
  const passed1a2 = !activityError1 && activityEvents1 && activityEvents1.length === 1;
  logTest('study_logs - activity event created', passed1a2,
    passed1a2 ? `Activity event created` : 
    `Expected 1 activity event, got ${activityEvents1?.length || 0}`);
  
  // Test 1b: Insert with 400 minutes -> XP capped at 30
  console.log('\n--- Test 1b: Insert study_log with 400 minutes (XP capped at 30) ---');
  
  const { data: log2, error: log2Error } = await supabase
    .from('study_logs')
    .insert({
      owner_id: userId,
      logged_on: today,
      minutes: 400,
      topic: 'long study session'
    })
    .select()
    .single();
  
  if (log2Error || !log2) {
    logTest('study_logs - insert 400 minutes', false, `Insert failed: ${log2Error?.message}`);
    return false;
  }
  
  cleanup.studyLogIds.push(log2.id);
  console.log(`   ✅ Inserted study_log ID: ${log2.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const { data: xpEvents2, error: xpError2 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'study_log')
    .eq('source_id', log2.id);
  
  const passed1b = !xpError2 && xpEvents2 && xpEvents2.length === 1 && xpEvents2[0].amount === 30;
  logTest('study_logs - 400 minutes -> 30 XP (capped)', passed1b,
    passed1b ? `XP event created with cap: ${xpEvents2[0].amount} XP` : 
    `Expected 1 XP event with 30 XP (capped), got ${xpEvents2?.length || 0} events with amount ${xpEvents2?.[0]?.amount || 'N/A'}`);
  
  // Test 1c: Insert with 0 minutes -> should fail (check constraint)
  console.log('\n--- Test 1c: Insert study_log with 0 minutes (should fail) ---');
  
  const { data: log3, error: log3Error } = await supabase
    .from('study_logs')
    .insert({
      owner_id: userId,
      logged_on: today,
      minutes: 0,
      topic: 'invalid'
    })
    .select()
    .single();
  
  const passed1c = log3Error && (log3Error.message.includes('check') || log3Error.message.includes('constraint') || log3Error.message.includes('minutes'));
  logTest('study_logs - 0 minutes rejected', passed1c,
    passed1c ? `Correctly rejected: ${log3Error.message}` : 
    `Expected check constraint error, got: ${log3Error?.message || 'no error (inserted successfully - WRONG!)'}`);
  
  // Test 1d: DELETE study_log -> XP and activity events removed
  console.log('\n--- Test 1d: DELETE study_log -> cleanup XP and activity ---');
  
  const { error: deleteError } = await supabase
    .from('study_logs')
    .delete()
    .eq('id', log1.id);
  
  if (deleteError) {
    logTest('study_logs - delete', false, `Delete failed: ${deleteError.message}`);
    return false;
  }
  
  console.log(`   ✅ Deleted study_log ID: ${log1.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check XP event removed
  const { data: xpEventsAfterDelete, error: xpErrorAfterDelete } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'study_log')
    .eq('source_id', log1.id);
  
  const passed1d1 = !xpErrorAfterDelete && xpEventsAfterDelete && xpEventsAfterDelete.length === 0;
  logTest('study_logs - delete removes XP event', passed1d1,
    passed1d1 ? `XP event removed` : 
    `Expected 0 XP events after delete, got ${xpEventsAfterDelete?.length || 0}`);
  
  // Check activity event removed
  const { data: activityEventsAfterDelete, error: activityErrorAfterDelete } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'study_logged')
    .eq('entity_id', log1.id);
  
  const passed1d2 = !activityErrorAfterDelete && activityEventsAfterDelete && activityEventsAfterDelete.length === 0;
  logTest('study_logs - delete removes activity event', passed1d2,
    passed1d2 ? `Activity event removed` : 
    `Expected 0 activity events after delete, got ${activityEventsAfterDelete?.length || 0}`);
  
  // Remove from cleanup list
  cleanup.studyLogIds = cleanup.studyLogIds.filter(id => id !== log1.id);
  
  return passed1a && passed1a2 && passed1b && passed1c && passed1d1 && passed1d2;
}

// Test 2: exercise_reports insert/delete XP triggers
async function testExerciseReports(supabase, userId) {
  console.log('\n=== Test 2: exercise_reports insert/delete XP triggers ===');
  
  // First, get module ID for 'module-001'
  const { data: module, error: moduleError } = await supabase
    .from('modules')
    .select('id')
    .eq('key', 'module-001')
    .single();
  
  if (moduleError || !module) {
    logTest('exercise_reports - find module-001', false, `Could not find module-001: ${moduleError?.message}`);
    return false;
  }
  
  const moduleId = module.id;
  console.log(`   Found module-001 with ID: ${moduleId}`);
  
  // Test 2a: Insert exercise_report -> XP +15
  console.log('\n--- Test 2a: Insert exercise_report -> 15 XP ---');
  
  const { data: report, error: reportError } = await supabase
    .from('exercise_reports')
    .insert({
      owner_id: userId,
      module_id: moduleId,
      confidence: 3,
      difficulty: 3,
      time_spent_minutes: 10,
      activity_title: 'test exercise'
    })
    .select()
    .single();
  
  if (reportError || !report) {
    logTest('exercise_reports - insert', false, `Insert failed: ${reportError?.message}`);
    return false;
  }
  
  cleanup.exerciseReportIds.push(report.id);
  console.log(`   ✅ Inserted exercise_report ID: ${report.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check XP event (should be 15 XP)
  const { data: xpEvents, error: xpError } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'exercise_report')
    .eq('source_id', report.id);
  
  const passed2a = !xpError && xpEvents && xpEvents.length === 1 && xpEvents[0].amount === 15;
  logTest('exercise_reports - insert -> 15 XP', passed2a,
    passed2a ? `XP event created: ${xpEvents[0].amount} XP` : 
    `Expected 1 XP event with 15 XP, got ${xpEvents?.length || 0} events with amount ${xpEvents?.[0]?.amount || 'N/A'}`);
  
  // Check activity event
  const { data: activityEvents, error: activityError } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'exercise_reported')
    .eq('entity_id', report.id);
  
  const passed2a2 = !activityError && activityEvents && activityEvents.length === 1;
  logTest('exercise_reports - activity event created', passed2a2,
    passed2a2 ? `Activity event created` : 
    `Expected 1 activity event, got ${activityEvents?.length || 0}`);
  
  // Test 2b: DELETE exercise_report -> XP and activity events removed
  console.log('\n--- Test 2b: DELETE exercise_report -> cleanup XP and activity ---');
  
  const { error: deleteError } = await supabase
    .from('exercise_reports')
    .delete()
    .eq('id', report.id);
  
  if (deleteError) {
    logTest('exercise_reports - delete', false, `Delete failed: ${deleteError.message}`);
    return false;
  }
  
  console.log(`   ✅ Deleted exercise_report ID: ${report.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check XP event removed
  const { data: xpEventsAfterDelete, error: xpErrorAfterDelete } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'exercise_report')
    .eq('source_id', report.id);
  
  const passed2b1 = !xpErrorAfterDelete && xpEventsAfterDelete && xpEventsAfterDelete.length === 0;
  logTest('exercise_reports - delete removes XP event', passed2b1,
    passed2b1 ? `XP event removed` : 
    `Expected 0 XP events after delete, got ${xpEventsAfterDelete?.length || 0}`);
  
  // Check activity event removed
  const { data: activityEventsAfterDelete, error: activityErrorAfterDelete } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'exercise_reported')
    .eq('entity_id', report.id);
  
  const passed2b2 = !activityErrorAfterDelete && activityEventsAfterDelete && activityEventsAfterDelete.length === 0;
  logTest('exercise_reports - delete removes activity event', passed2b2,
    passed2b2 ? `Activity event removed` : 
    `Expected 0 activity events after delete, got ${activityEventsAfterDelete?.length || 0}`);
  
  // Remove from cleanup list
  cleanup.exerciseReportIds = cleanup.exerciseReportIds.filter(id => id !== report.id);
  
  return passed2a && passed2a2 && passed2b1 && passed2b2;
}

// Test 3: achievements (upsert definition, insert earned -> XP, duplicate -> unique violation)
async function testAchievements(supabase, userId) {
  console.log('\n=== Test 3: achievements (definitions + earned) ===');
  
  // Test 3a: Upsert achievement_definition (run twice, should be idempotent)
  console.log('\n--- Test 3a: Upsert achievement_definition (idempotent) ---');
  
  const achievementKey = 'test_ach';
  const achievementData = {
    owner_id: userId,
    key: achievementKey,
    title: 'Test Achievement',
    description: 'Test description',
    icon: 'Zap',
    xp_reward: 42,
    criteria: {}
  };
  
  // First upsert
  const { data: def1, error: def1Error } = await supabase
    .from('achievement_definitions')
    .upsert(achievementData, { onConflict: 'owner_id,key' })
    .select()
    .single();
  
  if (def1Error || !def1) {
    logTest('achievements - upsert definition (first)', false, `Upsert failed: ${def1Error?.message}`);
    return false;
  }
  
  cleanup.achievementDefIds.push(def1.id);
  console.log(`   ✅ First upsert: achievement_definition ID: ${def1.id}`);
  
  // Second upsert (should update, not create new)
  const { data: def2, error: def2Error } = await supabase
    .from('achievement_definitions')
    .upsert(achievementData, { onConflict: 'owner_id,key' })
    .select()
    .single();
  
  if (def2Error || !def2) {
    logTest('achievements - upsert definition (second)', false, `Second upsert failed: ${def2Error?.message}`);
    return false;
  }
  
  console.log(`   ✅ Second upsert: achievement_definition ID: ${def2.id}`);
  
  // Check that both upserts returned the same ID
  const passed3a = def1.id === def2.id;
  logTest('achievements - upsert idempotent (same ID)', passed3a,
    passed3a ? `Both upserts returned same ID: ${def1.id}` : 
    `Expected same ID, got ${def1.id} and ${def2.id}`);
  
  // Verify only one row exists
  const { data: allDefs, error: allDefsError } = await supabase
    .from('achievement_definitions')
    .select('*')
    .eq('key', achievementKey);
  
  const passed3a2 = !allDefsError && allDefs && allDefs.length === 1;
  logTest('achievements - upsert creates only one row', passed3a2,
    passed3a2 ? `Only 1 row exists` : 
    `Expected 1 row, got ${allDefs?.length || 0}`);
  
  // Test 3b: Insert earned_achievement -> XP +42
  console.log('\n--- Test 3b: Insert earned_achievement -> 42 XP ---');
  
  const { data: earned, error: earnedError } = await supabase
    .from('earned_achievements')
    .insert({
      owner_id: userId,
      achievement_id: def1.id
    })
    .select()
    .single();
  
  if (earnedError || !earned) {
    logTest('achievements - insert earned', false, `Insert failed: ${earnedError?.message}`);
    return false;
  }
  
  cleanup.earnedAchievementIds.push(earned.id);
  console.log(`   ✅ Inserted earned_achievement ID: ${earned.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check XP event (should be 42 XP)
  const { data: xpEvents, error: xpError } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'achievement')
    .eq('source_id', def1.id);
  
  const passed3b = !xpError && xpEvents && xpEvents.length === 1 && xpEvents[0].amount === 42;
  logTest('achievements - earned -> 42 XP', passed3b,
    passed3b ? `XP event created: ${xpEvents[0].amount} XP` : 
    `Expected 1 XP event with 42 XP, got ${xpEvents?.length || 0} events with amount ${xpEvents?.[0]?.amount || 'N/A'}`);
  
  // Check activity event
  const { data: activityEvents, error: activityError } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'achievement_earned')
    .eq('entity_id', def1.id);
  
  const passed3b2 = !activityError && activityEvents && activityEvents.length === 1;
  logTest('achievements - activity event created', passed3b2,
    passed3b2 ? `Activity event created` : 
    `Expected 1 activity event, got ${activityEvents?.length || 0}`);
  
  // Test 3c: Insert same earned_achievement again -> unique violation (23505)
  console.log('\n--- Test 3c: Insert duplicate earned_achievement (should fail) ---');
  
  const { data: earned2, error: earned2Error } = await supabase
    .from('earned_achievements')
    .insert({
      owner_id: userId,
      achievement_id: def1.id
    })
    .select()
    .single();
  
  const passed3c = earned2Error && (earned2Error.code === '23505' || earned2Error.message.includes('unique') || earned2Error.message.includes('duplicate'));
  logTest('achievements - duplicate earned rejected', passed3c,
    passed3c ? `Correctly rejected: ${earned2Error.message}` : 
    `Expected unique violation (23505), got: ${earned2Error?.message || 'no error (inserted successfully - WRONG!)'}`);
  
  return passed3a && passed3a2 && passed3b && passed3b2 && passed3c;
}

// Test 4: milestone_roadmap_items (14 rows, 4 milestones, each milestone has >=2 roadmap_items)
async function testMilestoneRoadmapItems(supabase, userId) {
  console.log('\n=== Test 4: milestone_roadmap_items (14 links, 4 milestones) ===');
  
  // Test 4a: Count milestone_roadmap_items (should be 14)
  console.log('\n--- Test 4a: Count milestone_roadmap_items ---');
  
  const { data: items, error: itemsError, count } = await supabase
    .from('milestone_roadmap_items')
    .select('*', { count: 'exact' });
  
  const passed4a = !itemsError && items && items.length === 14;
  logTest('milestone_roadmap_items - count = 14', passed4a,
    passed4a ? `Found 14 milestone_roadmap_items` : 
    `Expected 14 rows, got ${items?.length || 0}. Error: ${itemsError?.message || 'none'}`);
  
  // Test 4b: Count milestones (should be 4)
  console.log('\n--- Test 4b: Count milestones ---');
  
  const { data: milestones, error: milestonesError } = await supabase
    .from('milestones')
    .select('*');
  
  const passed4b = !milestonesError && milestones && milestones.length === 4;
  logTest('milestones - count = 4', passed4b,
    passed4b ? `Found 4 milestones` : 
    `Expected 4 rows, got ${milestones?.length || 0}. Error: ${milestonesError?.message || 'none'}`);
  
  // Test 4c: Each milestone has >=2 linked roadmap_items
  console.log('\n--- Test 4c: Each milestone has >=2 roadmap_items ---');
  
  if (!milestones || milestones.length === 0) {
    logTest('milestones - each has >=2 roadmap_items', false, 'No milestones found');
    return false;
  }
  
  let allMilestonesHaveEnoughItems = true;
  for (const milestone of milestones) {
    const { data: linkedItems, error: linkedError } = await supabase
      .from('milestone_roadmap_items')
      .select('*')
      .eq('milestone_id', milestone.id);
    
    const itemCount = linkedItems?.length || 0;
    console.log(`   Milestone "${milestone.title}" (${milestone.id}): ${itemCount} roadmap_items`);
    
    if (itemCount < 2) {
      allMilestonesHaveEnoughItems = false;
      console.log(`   ❌ Milestone has only ${itemCount} items (expected >=2)`);
    }
  }
  
  logTest('milestones - each has >=2 roadmap_items', allMilestonesHaveEnoughItems,
    allMilestonesHaveEnoughItems ? `All milestones have >=2 roadmap_items` : 
    `Some milestones have <2 roadmap_items`);
  
  return passed4a && passed4b && allMilestonesHaveEnoughItems;
}

// Test 5: owner_settings (select, upsert weekly_goal_minutes)
async function testOwnerSettings(supabase, userId) {
  console.log('\n=== Test 5: owner_settings (weekly_goal_minutes) ===');
  
  // Test 5a: Select owner_settings (should have exactly 1 row)
  console.log('\n--- Test 5a: Select owner_settings ---');
  
  const { data: settings, error: settingsError } = await supabase
    .from('owner_settings')
    .select('*')
    .eq('owner_id', userId);
  
  const passed5a = !settingsError && settings && settings.length === 1;
  logTest('owner_settings - exactly 1 row', passed5a,
    passed5a ? `Found 1 owner_settings row` : 
    `Expected 1 row, got ${settings?.length || 0}. Error: ${settingsError?.message || 'none'}`);
  
  if (!settings || settings.length === 0) {
    return false;
  }
  
  const currentGoal = settings[0].weekly_goal_minutes;
  console.log(`   Current weekly_goal_minutes: ${currentGoal}`);
  
  // Test 5b: Upsert weekly_goal_minutes to 420
  console.log('\n--- Test 5b: Upsert weekly_goal_minutes to 420 ---');
  
  const { data: updated, error: updateError } = await supabase
    .from('owner_settings')
    .upsert({
      owner_id: userId,
      weekly_goal_minutes: 420
    }, { onConflict: 'owner_id' })
    .select()
    .single();
  
  if (updateError || !updated) {
    logTest('owner_settings - upsert to 420', false, `Upsert failed: ${updateError?.message}`);
    return false;
  }
  
  const passed5b = updated.weekly_goal_minutes === 420;
  logTest('owner_settings - upsert to 420', passed5b,
    passed5b ? `Updated to 420` : 
    `Expected 420, got ${updated.weekly_goal_minutes}`);
  
  // Test 5c: Re-read to verify
  console.log('\n--- Test 5c: Re-read to verify 420 ---');
  
  const { data: verified, error: verifyError } = await supabase
    .from('owner_settings')
    .select('*')
    .eq('owner_id', userId)
    .single();
  
  const passed5c = !verifyError && verified && verified.weekly_goal_minutes === 420;
  logTest('owner_settings - verify 420', passed5c,
    passed5c ? `Verified: 420` : 
    `Expected 420, got ${verified?.weekly_goal_minutes || 'N/A'}`);
  
  // Test 5d: Set back to 300
  console.log('\n--- Test 5d: Set back to 300 ---');
  
  const { data: restored, error: restoreError } = await supabase
    .from('owner_settings')
    .upsert({
      owner_id: userId,
      weekly_goal_minutes: 300
    }, { onConflict: 'owner_id' })
    .select()
    .single();
  
  const passed5d = !restoreError && restored && restored.weekly_goal_minutes === 300;
  logTest('owner_settings - restore to 300', passed5d,
    passed5d ? `Restored to 300` : 
    `Expected 300, got ${restored?.weekly_goal_minutes || 'N/A'}`);
  
  return passed5a && passed5b && passed5c && passed5d;
}

// Test 6: RLS negative tests (anonymous client)
async function testRLSNegative() {
  console.log('\n=== Test 6: RLS negative tests (anonymous client) ===');
  
  const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // Test 6a: Anonymous select from study_logs
  console.log('\n--- Test 6a: Anonymous select from study_logs ---');
  
  const { data: studyLogs, error: studyLogsError } = await anonClient
    .from('study_logs')
    .select('*');
  
  const passed6a = (studyLogsError && studyLogsError.message.includes('permission')) || 
                   (studyLogs && studyLogs.length === 0);
  logTest('RLS - anonymous denied study_logs', passed6a,
    passed6a ? `Anonymous access blocked: ${studyLogsError?.message || '0 rows'}` : 
    `Expected permission error or 0 rows, got ${studyLogs?.length || 0} rows`);
  
  // Test 6b: Anonymous select from earned_achievements
  console.log('\n--- Test 6b: Anonymous select from earned_achievements ---');
  
  const { data: achievements, error: achievementsError } = await anonClient
    .from('earned_achievements')
    .select('*');
  
  const passed6b = (achievementsError && achievementsError.message.includes('permission')) || 
                   (achievements && achievements.length === 0);
  logTest('RLS - anonymous denied earned_achievements', passed6b,
    passed6b ? `Anonymous access blocked: ${achievementsError?.message || '0 rows'}` : 
    `Expected permission error or 0 rows, got ${achievements?.length || 0} rows`);
  
  // Test 6c: Anonymous select from milestone_roadmap_items
  console.log('\n--- Test 6c: Anonymous select from milestone_roadmap_items ---');
  
  const { data: milestoneItems, error: milestoneItemsError } = await anonClient
    .from('milestone_roadmap_items')
    .select('*');
  
  const passed6c = (milestoneItemsError && milestoneItemsError.message.includes('permission')) || 
                   (milestoneItems && milestoneItems.length === 0);
  logTest('RLS - anonymous denied milestone_roadmap_items', passed6c,
    passed6c ? `Anonymous access blocked: ${milestoneItemsError?.message || '0 rows'}` : 
    `Expected permission error or 0 rows, got ${milestoneItems?.length || 0} rows`);
  
  return passed6a && passed6b && passed6c;
}

// Test 7: API smoke tests
async function testAPISmoke(token) {
  console.log('\n=== Test 7: API smoke tests ===');
  
  // Test 7a: GET /api/health
  console.log('\n--- Test 7a: GET /api/health ---');
  
  const { status: healthStatus, data: healthData } = await makeRequest('/health');
  
  const passed7a = healthStatus === 200 && healthData?.ok === true;
  logTest('API - GET /api/health returns 200', passed7a,
    passed7a ? `Response: ${JSON.stringify(healthData)}` : 
    `Expected 200 with ok:true, got ${healthStatus}: ${JSON.stringify(healthData)}`);
  
  // Test 7b: GET /api/seed/status (with bearer token)
  console.log('\n--- Test 7b: GET /api/seed/status ---');
  
  const { status: statusStatus, data: statusData } = await makeRequest('/seed/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const passed7b = statusStatus === 200 && 
                   statusData?.counts?.roadmap_items === 14 && 
                   statusData?.counts?.modules === 265;
  logTest('API - GET /api/seed/status (14 roadmap_items, 265 modules)', passed7b,
    passed7b ? `Counts: roadmap_items=${statusData.counts.roadmap_items}, modules=${statusData.counts.modules}` : 
    `Expected 200 with roadmap_items=14, modules=265, got ${statusStatus}: ${JSON.stringify(statusData?.counts)}`);
  
  return passed7a && passed7b;
}

// Cleanup function
async function cleanupTestData(supabase) {
  console.log('\n=== Cleaning up test data ===');
  
  // Delete earned achievements
  for (const id of cleanup.earnedAchievementIds) {
    await supabase.from('earned_achievements').delete().eq('id', id);
    console.log(`   ✅ Deleted earned_achievement: ${id}`);
  }
  
  // Delete achievement definitions (and their XP events via cascade)
  for (const id of cleanup.achievementDefIds) {
    // First delete XP events manually
    await supabase.from('xp_events').delete().eq('source_type', 'achievement').eq('source_id', id);
    // Delete activity events
    await supabase.from('activity_events').delete().eq('event_type', 'achievement_earned').eq('entity_id', id);
    // Delete definition
    await supabase.from('achievement_definitions').delete().eq('id', id);
    console.log(`   ✅ Deleted achievement_definition: ${id}`);
  }
  
  // Delete study logs (triggers will clean up XP and activity)
  for (const id of cleanup.studyLogIds) {
    await supabase.from('study_logs').delete().eq('id', id);
    console.log(`   ✅ Deleted study_log: ${id}`);
  }
  
  // Delete exercise reports (triggers will clean up XP and activity)
  for (const id of cleanup.exerciseReportIds) {
    await supabase.from('exercise_reports').delete().eq('id', id);
    console.log(`   ✅ Deleted exercise_report: ${id}`);
  }
  
  // Verify no XP events remain for this test session
  const { data: remainingXP, error: xpError } = await supabase
    .from('xp_events')
    .select('*')
    .in('source_type', ['study_log', 'exercise_report', 'achievement']);
  
  console.log(`   Final XP events check: ${remainingXP?.length || 0} rows (should be 0 for clean state)`);
  
  if (remainingXP && remainingXP.length > 0) {
    console.log('   ⚠️  Warning: Some XP events still remain. This may be from previous test runs.');
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║      Yuta\'s Lab Backend Test Suite v2 (Migration 003)        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`API Base: ${API_BASE}`);
  console.log(`Supabase: ${SUPABASE_URL}\n`);
  
  try {
    // Get authentication
    const auth = await getAuthenticatedClient();
    if (!auth) {
      console.error('\n❌ Cannot proceed - authentication failed');
      return;
    }
    
    const { token, userId, supabase } = auth;
    
    // Run all tests
    await testStudyLogs(supabase, userId);
    await testExerciseReports(supabase, userId);
    await testAchievements(supabase, userId);
    await testMilestoneRoadmapItems(supabase, userId);
    await testOwnerSettings(supabase, userId);
    await testRLSNegative();
    await testAPISmoke(token);
    
    // Cleanup
    await cleanupTestData(supabase);
    
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
