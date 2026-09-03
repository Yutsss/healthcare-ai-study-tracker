#!/usr/bin/env node
/**
 * Backend Test Suite v3 for Yuta's Lab
 * Tests new database behavior from migration 005_v1_completion.sql
 * - owner_settings pomodoro columns + bounds check
 * - study_logs focus dedupe (session_id unique constraint)
 * - weekly_quests XP-once-on-completion trigger
 * - projects XP(150)-once-on-completed + activity triggers
 * - RLS negative tests
 * - API smoke tests
 * - Regression: run backend_test.mjs and backend_test_v2.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

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
  weeklyQuestIds: [],
  projectIds: [],
  xpEventIds: [],
  activityEventIds: []
};

// Store original owner_settings values
let originalOwnerSettings = null;

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

// Test 1: owner_settings pomodoro columns + bounds check
async function testOwnerSettingsPomodoro(supabase, userId) {
  console.log('\n=== Test 1: owner_settings pomodoro columns + bounds check ===');
  
  // Test 1a: Read current owner_settings and verify pomodoro columns exist with defaults
  console.log('\n--- Test 1a: Verify pomodoro columns exist with defaults ---');
  
  const { data: settings, error: settingsError } = await supabase
    .from('owner_settings')
    .select('*')
    .eq('owner_id', userId)
    .single();
  
  if (settingsError || !settings) {
    logTest('owner_settings - read settings', false, `Failed to read: ${settingsError?.message}`);
    return false;
  }
  
  // Store original values for restoration
  originalOwnerSettings = {
    focus_minutes: settings.focus_minutes,
    short_break_minutes: settings.short_break_minutes,
    long_break_minutes: settings.long_break_minutes,
    long_break_every: settings.long_break_every
  };
  
  console.log(`   Current settings: focus=${settings.focus_minutes}, short_break=${settings.short_break_minutes}, long_break=${settings.long_break_minutes}, long_break_every=${settings.long_break_every}`);
  
  const passed1a = settings.focus_minutes === 25 && 
                   settings.short_break_minutes === 5 && 
                   settings.long_break_minutes === 15 && 
                   settings.long_break_every === 4;
  
  logTest('owner_settings - pomodoro defaults (25, 5, 15, 4)', passed1a,
    passed1a ? `Defaults correct` : 
    `Expected (25, 5, 15, 4), got (${settings.focus_minutes}, ${settings.short_break_minutes}, ${settings.long_break_minutes}, ${settings.long_break_every})`);
  
  // Test 1b: Update focus_minutes to 50 (valid)
  console.log('\n--- Test 1b: Update focus_minutes to 50 (valid) ---');
  
  const { data: updated1, error: update1Error } = await supabase
    .from('owner_settings')
    .update({ focus_minutes: 50 })
    .eq('owner_id', userId)
    .select()
    .single();
  
  const passed1b = !update1Error && updated1 && updated1.focus_minutes === 50;
  logTest('owner_settings - update focus_minutes to 50', passed1b,
    passed1b ? `Updated to 50` : 
    `Expected 50, got ${updated1?.focus_minutes || 'error: ' + update1Error?.message}`);
  
  // Test 1c: Update focus_minutes to 0 (invalid, should fail with check constraint)
  console.log('\n--- Test 1c: Update focus_minutes to 0 (should fail) ---');
  
  const { data: updated2, error: update2Error } = await supabase
    .from('owner_settings')
    .update({ focus_minutes: 0 })
    .eq('owner_id', userId)
    .select()
    .single();
  
  const passed1c = update2Error && (update2Error.code === '23514' || update2Error.message.includes('check') || update2Error.message.includes('constraint') || update2Error.message.includes('owner_settings_pomodoro_bounds'));
  logTest('owner_settings - focus_minutes=0 rejected (23514)', passed1c,
    passed1c ? `Correctly rejected: ${update2Error.message}` : 
    `Expected check constraint error (23514), got: ${update2Error?.message || 'no error (updated successfully - WRONG!)'}`);
  
  // Test 1d: Update focus_minutes to 500 (invalid, should fail with check constraint)
  console.log('\n--- Test 1d: Update focus_minutes to 500 (should fail) ---');
  
  const { data: updated3, error: update3Error } = await supabase
    .from('owner_settings')
    .update({ focus_minutes: 500 })
    .eq('owner_id', userId)
    .select()
    .single();
  
  const passed1d = update3Error && (update3Error.code === '23514' || update3Error.message.includes('check') || update3Error.message.includes('constraint') || update3Error.message.includes('owner_settings_pomodoro_bounds'));
  logTest('owner_settings - focus_minutes=500 rejected (23514)', passed1d,
    passed1d ? `Correctly rejected: ${update3Error.message}` : 
    `Expected check constraint error (23514), got: ${update3Error?.message || 'no error (updated successfully - WRONG!)'}`);
  
  // Test 1e: Restore original values
  console.log('\n--- Test 1e: Restore original values ---');
  
  const { data: restored, error: restoreError } = await supabase
    .from('owner_settings')
    .update({
      focus_minutes: originalOwnerSettings.focus_minutes,
      short_break_minutes: originalOwnerSettings.short_break_minutes,
      long_break_minutes: originalOwnerSettings.long_break_minutes,
      long_break_every: originalOwnerSettings.long_break_every
    })
    .eq('owner_id', userId)
    .select()
    .single();
  
  const passed1e = !restoreError && restored && 
                   restored.focus_minutes === originalOwnerSettings.focus_minutes &&
                   restored.short_break_minutes === originalOwnerSettings.short_break_minutes &&
                   restored.long_break_minutes === originalOwnerSettings.long_break_minutes &&
                   restored.long_break_every === originalOwnerSettings.long_break_every;
  
  logTest('owner_settings - restore original values', passed1e,
    passed1e ? `Restored to (${originalOwnerSettings.focus_minutes}, ${originalOwnerSettings.short_break_minutes}, ${originalOwnerSettings.long_break_minutes}, ${originalOwnerSettings.long_break_every})` : 
    `Failed to restore: ${restoreError?.message}`);
  
  return passed1a && passed1b && passed1c && passed1d && passed1e;
}

// Test 2: study_logs focus dedupe (session_id unique constraint)
async function testStudyLogsFocusDedupe(supabase, userId) {
  console.log('\n=== Test 2: study_logs focus dedupe (session_id unique constraint) ===');
  
  // Test 2a: Insert study_log with source='focus', session_id, focus_intervals=2, minutes=25
  console.log('\n--- Test 2a: Insert study_log with session_id ---');
  
  const sessionId = crypto.randomUUID();
  const today = new Date().toISOString().split('T')[0];
  
  const { data: log1, error: log1Error } = await supabase
    .from('study_logs')
    .insert({
      owner_id: userId,
      logged_on: today,
      minutes: 25,
      topic: 'Focus session test',
      source: 'focus',
      session_id: sessionId,
      focus_intervals: 2
    })
    .select()
    .single();
  
  if (log1Error || !log1) {
    logTest('study_logs - insert with session_id', false, `Insert failed: ${log1Error?.message}`);
    return false;
  }
  
  cleanup.studyLogIds.push(log1.id);
  console.log(`   ✅ Inserted study_log ID: ${log1.id}, session_id: ${sessionId}`);
  
  // Wait for XP trigger
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check XP event (should be ceil(25/10) = 3 XP)
  const { data: xpEvents1, error: xpError1 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'study_log')
    .eq('source_id', log1.id);
  
  const passed2a1 = !xpError1 && xpEvents1 && xpEvents1.length === 1 && xpEvents1[0].amount === 3;
  logTest('study_logs - 25 minutes -> 3 XP (ceil(25/10))', passed2a1,
    passed2a1 ? `XP event created: ${xpEvents1[0].amount} XP` : 
    `Expected 1 XP event with 3 XP, got ${xpEvents1?.length || 0} events with amount ${xpEvents1?.[0]?.amount || 'N/A'}`);
  
  if (xpEvents1 && xpEvents1.length > 0) {
    cleanup.xpEventIds.push(xpEvents1[0].id);
  }
  
  // Check activity event
  const { data: activityEvents1, error: activityError1 } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'study_logged')
    .eq('entity_id', log1.id);
  
  const passed2a2 = !activityError1 && activityEvents1 && activityEvents1.length === 1;
  logTest('study_logs - activity event created', passed2a2,
    passed2a2 ? `Activity event created` : 
    `Expected 1 activity event, got ${activityEvents1?.length || 0}`);
  
  if (activityEvents1 && activityEvents1.length > 0) {
    cleanup.activityEventIds.push(activityEvents1[0].id);
  }
  
  // Test 2b: Insert second study_log with SAME session_id (should fail with unique violation 23505)
  console.log('\n--- Test 2b: Insert with same session_id (should fail) ---');
  
  const { data: log2, error: log2Error } = await supabase
    .from('study_logs')
    .insert({
      owner_id: userId,
      logged_on: today,
      minutes: 30,
      topic: 'Duplicate session',
      source: 'focus',
      session_id: sessionId,
      focus_intervals: 3
    })
    .select()
    .single();
  
  const passed2b = log2Error && (log2Error.code === '23505' || log2Error.message.includes('unique') || log2Error.message.includes('duplicate') || log2Error.message.includes('uq_study_logs_owner_session'));
  logTest('study_logs - duplicate session_id rejected (23505)', passed2b,
    passed2b ? `Correctly rejected: ${log2Error.message}` : 
    `Expected unique violation (23505), got: ${log2Error?.message || 'no error (inserted successfully - WRONG!)'}`);
  
  // Test 2c: Insert with session_id=null twice (should both succeed, partial index)
  console.log('\n--- Test 2c: Insert with session_id=null twice (should both succeed) ---');
  
  const { data: log3, error: log3Error } = await supabase
    .from('study_logs')
    .insert({
      owner_id: userId,
      logged_on: today,
      minutes: 15,
      topic: 'Manual log 1',
      source: 'manual',
      session_id: null,
      focus_intervals: 0
    })
    .select()
    .single();
  
  const passed2c1 = !log3Error && log3;
  logTest('study_logs - insert with session_id=null (first)', passed2c1,
    passed2c1 ? `Inserted successfully: ${log3.id}` : 
    `Expected success, got error: ${log3Error?.message}`);
  
  if (log3) {
    cleanup.studyLogIds.push(log3.id);
  }
  
  const { data: log4, error: log4Error } = await supabase
    .from('study_logs')
    .insert({
      owner_id: userId,
      logged_on: today,
      minutes: 20,
      topic: 'Manual log 2',
      source: 'manual',
      session_id: null,
      focus_intervals: 0
    })
    .select()
    .single();
  
  const passed2c2 = !log4Error && log4;
  logTest('study_logs - insert with session_id=null (second)', passed2c2,
    passed2c2 ? `Inserted successfully: ${log4.id}` : 
    `Expected success, got error: ${log4Error?.message}`);
  
  if (log4) {
    cleanup.studyLogIds.push(log4.id);
  }
  
  return passed2a1 && passed2a2 && passed2b && passed2c1 && passed2c2;
}

// Test 3: weekly_quests XP-once-on-completion trigger
async function testWeeklyQuestsXP(supabase, userId) {
  console.log('\n=== Test 3: weekly_quests XP-once-on-completion trigger ===');
  
  const weekStart = new Date().toISOString().split('T')[0];
  
  // Test 3a: Insert quest with completed_at=null, xp_reward=50 (no XP event)
  console.log('\n--- Test 3a: Insert quest with completed_at=null (no XP) ---');
  
  const { data: quest1, error: quest1Error } = await supabase
    .from('weekly_quests')
    .insert({
      owner_id: userId,
      week_start: weekStart,
      key: 'test_quest_1',
      title: 'Test Quest 1',
      quest_type: 'test',
      target: 5,
      progress: 0,
      xp_reward: 50,
      description: 'Test quest description',
      completed_at: null
    })
    .select()
    .single();
  
  if (quest1Error || !quest1) {
    logTest('weekly_quests - insert with completed_at=null', false, `Insert failed: ${quest1Error?.message}`);
    return false;
  }
  
  cleanup.weeklyQuestIds.push(quest1.id);
  console.log(`   ✅ Inserted weekly_quest ID: ${quest1.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check no XP event created
  const { data: xpEvents1, error: xpError1 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'weekly_quest')
    .eq('source_id', quest1.id);
  
  const passed3a = !xpError1 && xpEvents1 && xpEvents1.length === 0;
  logTest('weekly_quests - no XP when completed_at=null', passed3a,
    passed3a ? `No XP event created (correct)` : 
    `Expected 0 XP events, got ${xpEvents1?.length || 0}`);
  
  // Test 3b: Update completed_at=now() (should create exactly one XP event + activity event)
  console.log('\n--- Test 3b: Update completed_at=now() (create XP + activity) ---');
  
  const { data: quest1Updated, error: quest1UpdateError } = await supabase
    .from('weekly_quests')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', quest1.id)
    .select()
    .single();
  
  if (quest1UpdateError) {
    logTest('weekly_quests - update completed_at', false, `Update failed: ${quest1UpdateError.message}`);
    return false;
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check exactly one XP event (50 XP)
  const { data: xpEvents2, error: xpError2 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'weekly_quest')
    .eq('source_id', quest1.id);
  
  const passed3b1 = !xpError2 && xpEvents2 && xpEvents2.length === 1 && xpEvents2[0].amount === 50;
  logTest('weekly_quests - exactly one XP event (50 XP)', passed3b1,
    passed3b1 ? `XP event created: ${xpEvents2[0].amount} XP` : 
    `Expected 1 XP event with 50 XP, got ${xpEvents2?.length || 0} events with amount ${xpEvents2?.[0]?.amount || 'N/A'}`);
  
  if (xpEvents2 && xpEvents2.length > 0) {
    xpEvents2.forEach(e => cleanup.xpEventIds.push(e.id));
  }
  
  // Check activity event (quest_completed)
  const { data: activityEvents2, error: activityError2 } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'quest_completed')
    .eq('entity_id', quest1.id);
  
  const passed3b2 = !activityError2 && activityEvents2 && activityEvents2.length === 1;
  logTest('weekly_quests - activity event quest_completed', passed3b2,
    passed3b2 ? `Activity event created` : 
    `Expected 1 activity event, got ${activityEvents2?.length || 0}`);
  
  if (activityEvents2 && activityEvents2.length > 0) {
    activityEvents2.forEach(e => cleanup.activityEventIds.push(e.id));
  }
  
  // Test 3c: Update again (e.g. change title, completed_at still set) -> still exactly one XP event
  console.log('\n--- Test 3c: Update again (completed_at still set) -> still one XP ---');
  
  const { data: quest1Updated2, error: quest1Update2Error } = await supabase
    .from('weekly_quests')
    .update({ title: 'Test Quest 1 Updated' })
    .eq('id', quest1.id)
    .select()
    .single();
  
  if (quest1Update2Error) {
    logTest('weekly_quests - update title', false, `Update failed: ${quest1Update2Error.message}`);
    return false;
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check still exactly one XP event
  const { data: xpEvents3, error: xpError3 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'weekly_quest')
    .eq('source_id', quest1.id);
  
  const passed3c = !xpError3 && xpEvents3 && xpEvents3.length === 1;
  logTest('weekly_quests - still exactly one XP event after update', passed3c,
    passed3c ? `Still 1 XP event (correct)` : 
    `Expected 1 XP event, got ${xpEvents3?.length || 0}`);
  
  // Test 3d: Insert quest already completed (completed_at set on insert) -> one XP event
  console.log('\n--- Test 3d: Insert quest with completed_at set (create XP) ---');
  
  const { data: quest2, error: quest2Error } = await supabase
    .from('weekly_quests')
    .insert({
      owner_id: userId,
      week_start: weekStart,
      key: 'test_quest_2',
      title: 'Test Quest 2',
      quest_type: 'test',
      target: 3,
      progress: 3,
      xp_reward: 75,
      description: 'Already completed quest',
      completed_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (quest2Error || !quest2) {
    logTest('weekly_quests - insert with completed_at set', false, `Insert failed: ${quest2Error?.message}`);
    return false;
  }
  
  cleanup.weeklyQuestIds.push(quest2.id);
  console.log(`   ✅ Inserted weekly_quest ID: ${quest2.id} (already completed)`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check one XP event (75 XP)
  const { data: xpEvents4, error: xpError4 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'weekly_quest')
    .eq('source_id', quest2.id);
  
  const passed3d = !xpError4 && xpEvents4 && xpEvents4.length === 1 && xpEvents4[0].amount === 75;
  logTest('weekly_quests - insert completed -> one XP event (75 XP)', passed3d,
    passed3d ? `XP event created: ${xpEvents4[0].amount} XP` : 
    `Expected 1 XP event with 75 XP, got ${xpEvents4?.length || 0} events with amount ${xpEvents4?.[0]?.amount || 'N/A'}`);
  
  if (xpEvents4 && xpEvents4.length > 0) {
    xpEvents4.forEach(e => cleanup.xpEventIds.push(e.id));
  }
  
  return passed3a && passed3b1 && passed3b2 && passed3c && passed3d;
}

// Test 4: projects XP(150)-once-on-completed + activity triggers
async function testProjectsXP(supabase, userId) {
  console.log('\n=== Test 4: projects XP(150)-once-on-completed + activity triggers ===');
  
  // Test 4a: Insert project with status='idea' -> activity event project_created, no XP
  console.log('\n--- Test 4a: Insert project status=idea (activity, no XP) ---');
  
  const { data: project1, error: project1Error } = await supabase
    .from('projects')
    .insert({
      owner_id: userId,
      key: 'test_project_1',
      title: 'Test Project 1',
      description: 'Test project description',
      project_type: 'web_app',
      status: 'idea',
      tags: ['test']
    })
    .select()
    .single();
  
  if (project1Error || !project1) {
    logTest('projects - insert status=idea', false, `Insert failed: ${project1Error?.message}`);
    return false;
  }
  
  cleanup.projectIds.push(project1.id);
  console.log(`   ✅ Inserted project ID: ${project1.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check activity event (project_created)
  const { data: activityEvents1, error: activityError1 } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'project_created')
    .eq('entity_id', project1.id);
  
  const passed4a1 = !activityError1 && activityEvents1 && activityEvents1.length === 1;
  logTest('projects - activity event project_created', passed4a1,
    passed4a1 ? `Activity event created` : 
    `Expected 1 activity event, got ${activityEvents1?.length || 0}`);
  
  if (activityEvents1 && activityEvents1.length > 0) {
    activityEvents1.forEach(e => cleanup.activityEventIds.push(e.id));
  }
  
  // Check no XP event
  const { data: xpEvents1, error: xpError1 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'project')
    .eq('source_id', project1.id);
  
  const passed4a2 = !xpError1 && xpEvents1 && xpEvents1.length === 0;
  logTest('projects - no XP for status=idea', passed4a2,
    passed4a2 ? `No XP event (correct)` : 
    `Expected 0 XP events, got ${xpEvents1?.length || 0}`);
  
  // Test 4b: Update status to 'in_progress' -> activity project_status_changed
  console.log('\n--- Test 4b: Update status to in_progress (activity) ---');
  
  const { data: project1Updated1, error: project1Update1Error } = await supabase
    .from('projects')
    .update({ status: 'in_progress' })
    .eq('id', project1.id)
    .select()
    .single();
  
  if (project1Update1Error) {
    logTest('projects - update to in_progress', false, `Update failed: ${project1Update1Error.message}`);
    return false;
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check activity event (project_status_changed)
  const { data: activityEvents2, error: activityError2 } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'project_status_changed')
    .eq('entity_id', project1.id);
  
  const passed4b = !activityError2 && activityEvents2 && activityEvents2.length === 1;
  logTest('projects - activity event project_status_changed', passed4b,
    passed4b ? `Activity event created` : 
    `Expected 1 activity event, got ${activityEvents2?.length || 0}`);
  
  if (activityEvents2 && activityEvents2.length > 0) {
    activityEvents2.forEach(e => cleanup.activityEventIds.push(e.id));
  }
  
  // Test 4c: Update status to 'completed' -> XP event 150 + activity project_completed
  console.log('\n--- Test 4c: Update status to completed (XP 150 + activity) ---');
  
  const { data: project1Updated2, error: project1Update2Error } = await supabase
    .from('projects')
    .update({ status: 'completed' })
    .eq('id', project1.id)
    .select()
    .single();
  
  if (project1Update2Error) {
    logTest('projects - update to completed', false, `Update failed: ${project1Update2Error.message}`);
    return false;
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check XP event (150 XP)
  const { data: xpEvents2, error: xpError2 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'project')
    .eq('source_id', project1.id);
  
  const passed4c1 = !xpError2 && xpEvents2 && xpEvents2.length === 1 && xpEvents2[0].amount === 150;
  logTest('projects - XP event 150 on completed', passed4c1,
    passed4c1 ? `XP event created: ${xpEvents2[0].amount} XP` : 
    `Expected 1 XP event with 150 XP, got ${xpEvents2?.length || 0} events with amount ${xpEvents2?.[0]?.amount || 'N/A'}`);
  
  if (xpEvents2 && xpEvents2.length > 0) {
    xpEvents2.forEach(e => cleanup.xpEventIds.push(e.id));
  }
  
  // Check activity event (project_completed)
  const { data: activityEvents3, error: activityError3 } = await supabase
    .from('activity_events')
    .select('*')
    .eq('event_type', 'project_completed')
    .eq('entity_id', project1.id);
  
  const passed4c2 = !activityError3 && activityEvents3 && activityEvents3.length === 1;
  logTest('projects - activity event project_completed', passed4c2,
    passed4c2 ? `Activity event created` : 
    `Expected 1 activity event, got ${activityEvents3?.length || 0}`);
  
  if (activityEvents3 && activityEvents3.length > 0) {
    activityEvents3.forEach(e => cleanup.activityEventIds.push(e.id));
  }
  
  // Test 4d: Set back to in_progress then completed again -> still exactly ONE XP event of 150
  console.log('\n--- Test 4d: Set to in_progress then completed again (still one XP) ---');
  
  // Set to in_progress
  await supabase
    .from('projects')
    .update({ status: 'in_progress' })
    .eq('id', project1.id);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Set to completed again
  await supabase
    .from('projects')
    .update({ status: 'completed' })
    .eq('id', project1.id);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check still exactly one XP event
  const { data: xpEvents3, error: xpError3 } = await supabase
    .from('xp_events')
    .select('*')
    .eq('source_type', 'project')
    .eq('source_id', project1.id);
  
  const passed4d = !xpError3 && xpEvents3 && xpEvents3.length === 1 && xpEvents3[0].amount === 150;
  logTest('projects - still exactly ONE XP event (150) after re-completion', passed4d,
    passed4d ? `Still 1 XP event with 150 XP (correct)` : 
    `Expected 1 XP event with 150 XP, got ${xpEvents3?.length || 0} events with amount ${xpEvents3?.[0]?.amount || 'N/A'}`);
  
  return passed4a1 && passed4a2 && passed4b && passed4c1 && passed4c2 && passed4d;
}

// Test 5: RLS negative tests
async function testRLSNegative() {
  console.log('\n=== Test 5: RLS negative tests (anonymous client) ===');
  
  const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // Test 5a: Anonymous select from weekly_quests
  console.log('\n--- Test 5a: Anonymous denied weekly_quests ---');
  
  const { data: quests, error: questsError } = await anonClient
    .from('weekly_quests')
    .select('*');
  
  const passed5a = (questsError && questsError.message.includes('permission')) || 
                   (quests && quests.length === 0);
  logTest('RLS - anonymous denied weekly_quests', passed5a,
    passed5a ? `Anonymous access blocked: ${questsError?.message || '0 rows'}` : 
    `Expected permission error or 0 rows, got ${quests?.length || 0} rows`);
  
  // Test 5b: Anonymous select from projects
  console.log('\n--- Test 5b: Anonymous denied projects ---');
  
  const { data: projects, error: projectsError } = await anonClient
    .from('projects')
    .select('*');
  
  const passed5b = (projectsError && projectsError.message.includes('permission')) || 
                   (projects && projects.length === 0);
  logTest('RLS - anonymous denied projects', passed5b,
    passed5b ? `Anonymous access blocked: ${projectsError?.message || '0 rows'}` : 
    `Expected permission error or 0 rows, got ${projects?.length || 0} rows`);
  
  // Test 5c: Spoofed owner_id insert into projects (should be rejected 42501)
  console.log('\n--- Test 5c: Spoofed owner_id insert rejected ---');
  
  const { data: spoofed, error: spoofedError } = await anonClient
    .from('projects')
    .insert({
      owner_id: '00000000-0000-0000-0000-000000000000',
      title: 'Spoofed Project',
      status: 'idea'
    })
    .select()
    .single();
  
  const passed5c = spoofedError && (spoofedError.code === '42501' || spoofedError.message.includes('permission') || spoofedError.message.includes('policy'));
  logTest('RLS - spoofed owner_id insert rejected (42501)', passed5c,
    passed5c ? `RLS correctly blocked: ${spoofedError.message}` : 
    `Expected RLS error (42501), got: ${spoofedError?.message || 'no error (inserted successfully - SECURITY ISSUE!)'}`);
  
  return passed5a && passed5b && passed5c;
}

// Test 6: API smoke tests
async function testAPISmoke(token) {
  console.log('\n=== Test 6: API smoke tests ===');
  
  // Test 6a: GET /api/health
  console.log('\n--- Test 6a: GET /api/health ---');
  
  const { status: healthStatus, data: healthData } = await makeRequest('/health');
  
  const passed6a = healthStatus === 200 && healthData?.ok === true;
  logTest('API - GET /api/health returns 200 ok:true', passed6a,
    passed6a ? `Response: ${JSON.stringify(healthData)}` : 
    `Expected 200 with ok:true, got ${healthStatus}: ${JSON.stringify(healthData)}`);
  
  // Test 6b: GET /api/seed/status
  console.log('\n--- Test 6b: GET /api/seed/status ---');
  
  const { status: statusStatus, data: statusData } = await makeRequest('/seed/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const passed6b = statusStatus === 200 && 
                   statusData?.counts?.roadmap_items === 14 && 
                   statusData?.counts?.modules === 265;
  logTest('API - GET /api/seed/status (14 roadmap_items, 265 modules)', passed6b,
    passed6b ? `Counts: roadmap_items=${statusData.counts.roadmap_items}, modules=${statusData.counts.modules}` : 
    `Expected 200 with roadmap_items=14, modules=265, got ${statusStatus}: ${JSON.stringify(statusData?.counts)}`);
  
  return passed6a && passed6b;
}

// Cleanup function
async function cleanupTestData(supabase, userId) {
  console.log('\n=== Cleaning up test data ===');
  
  // Delete study logs (triggers will clean up XP and activity)
  for (const id of cleanup.studyLogIds) {
    await supabase.from('study_logs').delete().eq('id', id);
    console.log(`   ✅ Deleted study_log: ${id}`);
  }
  
  // Delete weekly quests
  for (const id of cleanup.weeklyQuestIds) {
    // Delete XP events manually
    await supabase.from('xp_events').delete().eq('source_type', 'weekly_quest').eq('source_id', id);
    // Delete activity events
    await supabase.from('activity_events').delete().eq('entity_type', 'weekly_quest').eq('entity_id', id);
    // Delete quest
    await supabase.from('weekly_quests').delete().eq('id', id);
    console.log(`   ✅ Deleted weekly_quest: ${id}`);
  }
  
  // Delete projects
  for (const id of cleanup.projectIds) {
    // Delete XP events manually
    await supabase.from('xp_events').delete().eq('source_type', 'project').eq('source_id', id);
    // Delete activity events
    await supabase.from('activity_events').delete().eq('entity_type', 'project').eq('entity_id', id);
    // Delete project
    await supabase.from('projects').delete().eq('id', id);
    console.log(`   ✅ Deleted project: ${id}`);
  }
  
  // Verify final state
  console.log('\n=== Verifying final DB state ===');
  
  // Check XP events
  const { data: xpEvents, error: xpError } = await supabase
    .from('xp_events')
    .select('*')
    .eq('owner_id', userId);
  
  console.log(`   XP events: ${xpEvents?.length || 0} (should be 0 for clean state)`);
  logTest('Cleanup - XP events count', xpEvents?.length === 0, 
    xpEvents?.length === 0 ? 'All XP events cleaned up' : `${xpEvents?.length || 0} XP events remain`);
  
  // Check activity events
  const { data: activityEvents, error: activityError } = await supabase
    .from('activity_events')
    .select('*')
    .eq('owner_id', userId);
  
  console.log(`   Activity events: ${activityEvents?.length || 0} (should be 0 for clean state)`);
  logTest('Cleanup - Activity events count', activityEvents?.length === 0,
    activityEvents?.length === 0 ? 'All activity events cleaned up' : `${activityEvents?.length || 0} activity events remain`);
  
  // Check projects
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', userId);
  
  console.log(`   Projects: ${projects?.length || 0} (should be 0 test projects)`);
  logTest('Cleanup - Projects count', projects?.length === 0,
    projects?.length === 0 ? 'No test projects remain' : `${projects?.length || 0} projects remain`);
  
  // Check weekly quests
  const { data: quests, error: questsError } = await supabase
    .from('weekly_quests')
    .select('*')
    .eq('owner_id', userId);
  
  console.log(`   Weekly quests: ${quests?.length || 0} (should be 0 test quests)`);
  logTest('Cleanup - Weekly quests count', quests?.length === 0,
    quests?.length === 0 ? 'No test quests remain' : `${quests?.length || 0} quests remain`);
  
  // Check owner_settings restored
  const { data: settings, error: settingsError } = await supabase
    .from('owner_settings')
    .select('*')
    .eq('owner_id', userId)
    .single();
  
  const settingsRestored = settings && 
    settings.focus_minutes === originalOwnerSettings.focus_minutes &&
    settings.short_break_minutes === originalOwnerSettings.short_break_minutes &&
    settings.long_break_minutes === originalOwnerSettings.long_break_minutes &&
    settings.long_break_every === originalOwnerSettings.long_break_every;
  
  console.log(`   Owner settings: focus=${settings?.focus_minutes}, short_break=${settings?.short_break_minutes}, long_break=${settings?.long_break_minutes}, long_break_every=${settings?.long_break_every}`);
  logTest('Cleanup - Owner settings restored', settingsRestored,
    settingsRestored ? 'Owner settings restored to original values' : 'Owner settings NOT restored');
}

// Test 7: Regression tests
async function runRegressionTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    REGRESSION TESTS                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  // Run backend_test.mjs
  console.log('\n=== Running backend_test.mjs ===');
  try {
    execSync('node /app/tests/backend_test.mjs', { 
      stdio: 'inherit',
      cwd: '/app'
    });
    logTest('Regression - backend_test.mjs', true, 'All tests passed');
  } catch (error) {
    logTest('Regression - backend_test.mjs', false, `Some tests failed (exit code ${error.status})`);
  }
  
  // Run backend_test_v2.mjs
  console.log('\n=== Running backend_test_v2.mjs ===');
  try {
    execSync('node /app/tests/backend_test_v2.mjs', { 
      stdio: 'inherit',
      cwd: '/app'
    });
    logTest('Regression - backend_test_v2.mjs', true, 'All tests passed');
  } catch (error) {
    logTest('Regression - backend_test_v2.mjs', false, `Some tests failed (exit code ${error.status})`);
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║      Yuta\'s Lab Backend Test Suite v3 (Migration 005)        ║');
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
    await testOwnerSettingsPomodoro(supabase, userId);
    await testStudyLogsFocusDedupe(supabase, userId);
    await testWeeklyQuestsXP(supabase, userId);
    await testProjectsXP(supabase, userId);
    await testRLSNegative();
    await testAPISmoke(token);
    
    // Cleanup
    await cleanupTestData(supabase, userId);
    
    // Regression tests
    await runRegressionTests();
    
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
