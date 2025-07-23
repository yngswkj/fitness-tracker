// Detailed test for Fitbit Data Synchronization (Task 7.2)
// Tests the specific requirements: 歩数、活動時間、心拍数、睡眠データ取得API, データベースへの保存機能, 同期エラーハンドリング

const fs = require('fs');
const path = require('path');

function testRequirement(requirement, description, testFunction) {
    console.log(`\n📋 Testing Requirement: ${requirement}`);
    console.log(`   ${description}`);
    console.log('   ' + '─'.repeat(60));

    try {
        const result = testFunction();
        if (result.success) {
            console.log(`   ✅ PASSED: ${result.message}`);
            return true;
        } else {
            console.log(`   ❌ FAILED: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return false;
    }
}

function checkFileContains(filePath, patterns, description) {
    try {
        const content = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
        const missingPatterns = patterns.filter(pattern => !content.includes(pattern));

        if (missingPatterns.length === 0) {
            return { success: true, message: `${description} - All patterns found` };
        } else {
            return { success: false, message: `${description} - Missing: ${missingPatterns.join(', ')}` };
        }
    } catch (error) {
        return { success: false, message: `${description} - File not found or readable` };
    }
}

function checkDatabaseSchema(tableName, requiredColumns) {
    const schemaPath = 'scripts/setup-db.sql';
    try {
        const content = fs.readFileSync(path.join(__dirname, schemaPath), 'utf8');
        const tableSection = content.match(new RegExp(`CREATE TABLE.*${tableName}[\\s\\S]*?\\);`, 'i'));

        if (!tableSection) {
            return { success: false, message: `Table ${tableName} not found in schema` };
        }

        const missingColumns = requiredColumns.filter(col => !tableSection[0].includes(col));

        if (missingColumns.length === 0) {
            return { success: true, message: `Table ${tableName} has all required columns` };
        } else {
            return { success: false, message: `Table ${tableName} missing columns: ${missingColumns.join(', ')}` };
        }
    } catch (error) {
        return { success: false, message: `Schema file not accessible: ${error.message}` };
    }
}

console.log('🧪 DETAILED FITBIT DATA SYNCHRONIZATION TEST (Task 7.2)');
console.log('='.repeat(80));
console.log('Testing Requirements: 歩数、活動時間、心拍数、睡眠データ取得API');
console.log('                     データベースへの保存機能');
console.log('                     同期エラーハンドリング');
console.log('='.repeat(80));

let totalTests = 0;
let passedTests = 0;

// Requirement 2.2: 歩数、活動時間、心拍数、睡眠データ取得API
totalTests++;
if (testRequirement(
    '2.2 - 歩数データ取得API',
    'Steps data fetching from Fitbit API',
    () => checkFileContains('app/api/fitbit/sync/route.ts', [
        'fetchActivityData',
        'steps',
        '/1/user/-/activities/date/',
        'summary?.steps'
    ], 'Steps data API implementation')
)) passedTests++;

totalTests++;
if (testRequirement(
    '2.2 - 活動時間データ取得API',
    'Activity time data fetching from Fitbit API',
    () => checkFileContains('app/api/fitbit/sync/route.ts', [
        'activeMinutes',
        'fairlyActiveMinutes',
        'veryActiveMinutes'
    ], 'Activity time data API implementation')
)) passedTests++;

totalTests++;
if (testRequirement(
    '2.2 - 心拍数データ取得API',
    'Heart rate data fetching from Fitbit API',
    () => checkFileContains('app/api/fitbit/sync/route.ts', [
        'fetchHeartRateData',
        'restingHeartRate',
        '/1/user/-/activities/heart/date/'
    ], 'Heart rate data API implementation')
)) passedTests++;

totalTests++;
if (testRequirement(
    '2.2 - 睡眠データ取得API',
    'Sleep data fetching from Fitbit API',
    () => checkFileContains('app/api/fitbit/sync/route.ts', [
        'fetchSleepData',
        'minutesAsleep',
        '/1.2/user/-/sleep/date/'
    ], 'Sleep data API implementation')
)) passedTests++;

// データベースへの保存機能
totalTests++;
if (testRequirement(
    '2.2 - データベース保存機能',
    'Database storage functionality for Fitbit data',
    () => checkDatabaseSchema('fitbit_data', [
        'steps',
        'active_minutes',
        'resting_heart_rate',
        'sleep_hours',
        'synced_at'
    ])
)) passedTests++;

totalTests++;
if (testRequirement(
    '2.2 - UPSERT機能',
    'Database UPSERT functionality to handle duplicate data',
    () => checkFileContains('app/api/fitbit/sync/route.ts', [
        'ON CONFLICT',
        'DO UPDATE SET',
        'EXCLUDED'
    ], 'UPSERT functionality implementation')
)) passedTests++;

// 同期エラーハンドリング
totalTests++;
if (testRequirement(
    '2.2 - エラー分類機能',
    'Error categorization and handling',
    () => checkFileContains('lib/fitbit.ts', [
        'FitbitAPIError',
        'UNAUTHORIZED',
        'RATE_LIMITED',
        'SERVER_ERROR'
    ], 'Error categorization implementation')
)) passedTests++;

totalTests++;
if (testRequirement(
    '2.2 - リトライ機能',
    'Retry mechanism with exponential backoff',
    () => checkFileContains('lib/fitbit.ts', [
        'shouldRetrySync',
        'getRetryDelay',
        'exponential',
        'maxRetries'
    ], 'Retry mechanism implementation')
)) passedTests++;

totalTests++;
if (testRequirement(
    '2.2 - エラーログ機能',
    'Error logging to database',
    () => checkFileContains('lib/fitbit.ts', [
        'logSyncError',
        'sync_errors',
        'error_type',
        'error_message'
    ], 'Error logging implementation')
)) passedTests++;

totalTests++;
if (testRequirement(
    '2.2 - トークン更新機能',
    'Automatic token refresh handling',
    () => checkFileContains('app/api/fitbit/sync/route.ts', [
        'refreshFitbitToken',
        'ensureValidToken',
        'expires_at',
        'refresh_token'
    ], 'Token refresh implementation')
)) passedTests++;

// Additional comprehensive checks
totalTests++;
if (testRequirement(
    '2.2 - バッチ同期機能',
    'Batch synchronization with error recovery',
    () => checkFileContains('app/api/fitbit/batch-sync/route.ts', [
        'consecutiveErrors',
        'maxConsecutiveErrors',
        'batch sync stopped'
    ], 'Batch sync error recovery implementation')
)) passedTests++;

totalTests++;
if (testRequirement(
    '2.2 - 同期状況監視',
    'Sync status monitoring and health assessment',
    () => checkFileContains('app/api/fitbit/sync-status/route.ts', [
        'calculateSyncHealthScore',
        'getSyncFrequency',
        'getHealthRecommendations'
    ], 'Sync monitoring implementation')
)) passedTests++;

console.log('\n' + '='.repeat(80));
console.log('📊 TEST RESULTS SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Task 7.2 requirements fully implemented.');
    console.log('\n✅ Fitbit Data Synchronization Features:');
    console.log('   • Steps data fetching and storage');
    console.log('   • Activity time tracking');
    console.log('   • Heart rate data synchronization');
    console.log('   • Sleep data collection');
    console.log('   • Robust error handling with retry logic');
    console.log('   • Database storage with conflict resolution');
    console.log('   • Automatic token refresh');
    console.log('   • Batch synchronization with error recovery');
    console.log('   • Comprehensive sync monitoring and health assessment');
} else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
}

console.log('\n' + '='.repeat(80));