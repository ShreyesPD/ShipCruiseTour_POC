#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Complete Workflow Starting...\n');
console.log('═'.repeat(80));

const steps = {
  startProject: false,
  runTests: false,
  syncJira: false,
  generateDashboard: false,
  analyzeErrors: false,
  applyFixes: false,
  createPR: false
};

async function runWorkflow() {
  try {
    // Step 1: Start the project
    console.log('\n📋 Step 1: Starting the project...');
    console.log('─'.repeat(80));
    
    const serverProcess = startProjectServer();
    steps.startProject = true;
    console.log('✅ Project server started');
    
    // Wait for server to be ready
    await waitForServer('http://localhost:8000', 30000);
    console.log('✅ Server is ready');
    
    // Auto-launch website in browser
    console.log('🌐 Opening website in browser...');
    await openInBrowser('http://localhost:8000');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for browser to open
    
    // Step 2: Run tests
    console.log('\n📋 Step 2: Running tests...');
    console.log('─'.repeat(80));
    
    const testResults = runTests();
    steps.runTests = true;
    
    if (testResults.allPassed) {
      console.log('✅ All tests passed! No fixes needed.');
      // Still sync Jira (0 failures = no new tickets, board unchanged)
      const jiraResults = await syncJiraBoard();
      steps.syncJira = true;
      if (jiraResults.skipped) {
        console.log('⚠️  Jira not configured. Set JIRA_* in .env to update board on failures.');
      }
      serverProcess.kill();
      return { success: true, message: 'All tests passed' };
    }
    
    console.log(`⚠️  Found ${testResults.failureCount} test failure(s)`);
    
    // Step 2.5: Update Jira board with test results (creates issues for failures via API)
    console.log('\n📋 Step 2.5: Updating Jira board...');
    console.log('─'.repeat(80));
    const jiraResults = await syncJiraBoard();
    steps.syncJira = true;
    if (jiraResults.created > 0) {
      console.log(`✅ Created ${jiraResults.created} Jira ticket(s). Board updated.`);
      (jiraResults.urls || []).forEach(url => console.log(`   ${url}`));
    } else if (jiraResults.skipped) {
      console.log('⚠️  Jira skipped (missing .env: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY)');
    } else {
      console.log('✅ No failed tests to report; Jira board unchanged.');
    }
    
    // Step 3: Generate dashboard
    console.log('\n📋 Step 3: Generating test dashboard...');
    console.log('─'.repeat(80));
    
    execSync('node scripts/build-dashboard.js', { stdio: 'inherit' });
    steps.generateDashboard = true;
    console.log('✅ Dashboard generated');
    
    // Start live server for dashboard
    dashboardServer = await startDashboardServer();
    console.log('📊 Opening test dashboard in browser...');
    await openInBrowser('http://localhost:3000');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for browser to open
    
    // Step 4: Analyze errors with AI
    console.log('\n📋 Step 4: Analyzing errors with AI...');
    console.log('─'.repeat(80));
    
    const analysisResults = await analyzeWithAI();
    steps.analyzeErrors = true;
    
    if (!analysisResults || !analysisResults.hasErrors) {
      console.log('✅ No actionable errors found');
      serverProcess.kill();
      return { success: true, message: 'No errors to fix' };
    }
    
    console.log(`✅ Analyzed ${analysisResults.analysisResults?.length || 0} error(s)`);
    
    // Step 5: Apply fixes
    console.log('\n📋 Step 5: Applying AI-suggested fixes...');
    console.log('─'.repeat(80));
    
    const fixResults = await applyFixes(analysisResults);
    steps.applyFixes = true;
    console.log(`✅ Applied ${fixResults.successfulFixes} fix(es)`);
    
    // Step 6: Verify fixes
    console.log('\n📋 Step 6: Verifying fixes...');
    console.log('─'.repeat(80));
    
    const verifyResults = runTests();
    
    if (verifyResults.allPassed) {
      console.log('✅ All tests now passing!');
    } else {
      console.log(`⚠️  ${verifyResults.failureCount} test(s) still failing`);
    }
    
    // Step 7: Create PR
    console.log('\n📋 Step 7: Creating GitHub Pull Request...');
    console.log('─'.repeat(80));
    
    const prResults = await createPR(analysisResults, fixResults);
    steps.createPR = true;
    
    if (prResults.success) {
      console.log(`✅ Pull Request created: ${prResults.prUrl}`);
    }
    
    // Cleanup
    console.log('\n📋 Cleaning up...');
    serverProcess.kill();
    if (dashboardServer) {
      dashboardServer.kill();
    }
    console.log('✅ Servers stopped');
    
    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('✅ Complete Workflow Finished!');
    console.log('═'.repeat(80));
    console.log('\nSummary:');
    console.log(`  Tests Run: ${testResults.totalTests}`);
    console.log(`  Initial Failures: ${testResults.failureCount}`);
    console.log(`  Jira Tickets Created: ${jiraResults.created || 0}`);
    console.log(`  Fixes Applied: ${fixResults.successfulFixes}`);
    console.log(`  Final Status: ${verifyResults.allPassed ? '✅ All Passing' : `⚠️  ${verifyResults.failureCount} Still Failing`}`);
    if (prResults.success) {
      console.log(`  Pull Request: ${prResults.prUrl}`);
    }
    console.log('\n📊 View dashboard: custom-report/index.html');
    console.log('📊 View AI report: ai-agent-reports/latest-report.json');
    
    return { success: true, results: { testResults, analysisResults, fixResults, prResults } };
    
  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

async function openInBrowser(url) {
  const { exec } = require('child_process');
  const command = process.platform === 'win32' ? 'start' : 
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
  
  exec(`${command} ${url}`, (error) => {
    if (error) {
      console.log(`   ℹ️  Could not auto-open browser. Please visit: ${url}`);
    }
  });
}

async function startDashboardServer() {
  console.log('Starting dashboard server on port 3000...');
  
  const http = require('http');
  const dashboardDir = path.join(process.cwd(), 'custom-report');
  
  const server = http.createServer((req, res) => {
    let filePath = path.join(dashboardDir, req.url === '/' ? 'index.html' : req.url);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(dashboardDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    const extname = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    
    const contentType = contentTypes[extname] || 'text/plain';
    
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end('Server error: ' + error.code);
        }
      } else {
        res.writeHead(200, { 
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content, 'utf-8');
      }
    });
  });
  
  server.listen(3000);
  
  // Return a mock process object with kill method
  return {
    kill: () => {
      server.close();
      console.log('✅ Dashboard server stopped');
    }
  };
}

function startProjectServer() {
  console.log('Starting PHP server on port 8000...');
  
  const isWindows = process.platform === 'win32';
  const phpPath = 'php';
  const docRoot = path.join(process.cwd(), 'website', 'public');
  
  const serverProcess = spawn(phpPath, ['-S', 'localhost:8000', '-t', docRoot], {
    detached: false,
    stdio: 'ignore'
  });
  
  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error.message);
  });
  
  return serverProcess;
}

async function waitForServer(url, timeout = 30000) {
  const startTime = Date.now();
  const fetch = (await import('node-fetch')).default;
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Server failed to start within timeout');
}

function runTests() {
  console.log('Running Playwright tests...');
  
  try {
    execSync('npx playwright test', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    // Even if tests pass, check the results file
    const resultsPath = path.join(process.cwd(), 'test-results.json');
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      const counts = countTestResults(results);
      return {
        allPassed: counts.failureCount === 0,
        failureCount: counts.failureCount,
        totalTests: counts.totalTests
      };
    }
    
    return {
      allPassed: true,
      failureCount: 0,
      totalTests: 0
    };
  } catch (error) {
    // Tests failed, parse results
    const resultsPath = path.join(process.cwd(), 'test-results.json');
    
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      const counts = countTestResults(results);
      
      return {
        allPassed: false,
        failureCount: counts.failureCount,
        totalTests: counts.totalTests
      };
    }
    
    return {
      allPassed: false,
      failureCount: 1,
      totalTests: 1
    };
  }
}

function countTestResults(results) {
  // Use the stats object which has accurate counts
  if (results.stats) {
    return {
      totalTests: results.stats.expected + results.stats.unexpected + results.stats.skipped,
      failureCount: results.stats.unexpected + results.stats.flaky
    };
  }
  
  // Fallback to manual counting if stats not available
  let totalTests = 0;
  let failureCount = 0;
  
  const countTests = (suites) => {
    for (const suite of suites) {
      if (suite.tests) {
        for (const test of suite.tests) {
          totalTests++;
          // Check test status - "unexpected" means failed
          if (test.status === 'unexpected' || test.status === 'flaky') {
            failureCount++;
          }
          // Also check results array
          else if (test.results && test.results.length > 0) {
            const hasFailure = test.results.some(result => 
              result.status === 'failed' || 
              result.status === 'timedOut' ||
              result.status === 'interrupted'
            );
            if (hasFailure) {
              failureCount++;
            }
          }
        }
      }
      if (suite.suites) {
        countTests(suite.suites);
      }
    }
  };
  
  if (results.suites) {
    countTests(results.suites);
  }
  
  return { totalTests, failureCount };
}

async function syncJiraBoard() {
  const { createJiraTicketsFromTestResults } = require('./jira-issue-creator');
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;
  if (!baseUrl || !email || !token || !projectKey) {
    return { created: 0, keys: [], urls: [], skipped: true };
  }
  const resultsPath = path.join(process.cwd(), 'test-results.json');
  const config = {
    jiraBaseUrl: baseUrl,
    jiraEmail: email,
    jiraApiToken: token,
    jiraProjectKey: projectKey,
    jiraIssueType: process.env.JIRA_ISSUE_TYPE || 'Bug'
  };
  try {
    const result = await createJiraTicketsFromTestResults(config, resultsPath);
    return {
      created: result.created,
      keys: result.keys || [],
      urls: result.urls || [],
      skipped: false
    };
  } catch (err) {
    console.error('Jira sync failed:', err.message);
    return { created: 0, keys: [], urls: [], skipped: false, error: err.message };
  }
}

function generateDashboard() {
  console.log('Building custom dashboard...');
  
  try {
    execSync('node scripts/build-dashboard.js', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    console.warn('Dashboard generation failed:', error.message);
  }
}

async function analyzeWithAI() {
  console.log('Running AI Agent for error analysis...');
  
  const AIAgentOrchestrator = require('../ai-agent/orchestrator');
  const config = loadConfig();
  
  const orchestrator = new AIAgentOrchestrator({
    ...config,
    createPR: false, // We'll create PR separately
    autoCommit: false
  });
  
  // Run just the analysis part
  const testResults = orchestrator.loadTestResults();
  if (!testResults) {
    return { hasErrors: false };
  }
  
  const analysisResults = await orchestrator.errorAnalyzer.analyzeTestFailures(testResults);
  
  return analysisResults;
}

async function applyFixes(analysisResults) {
  console.log('Applying fixes...');
  
  const CodeFixer = require('../ai-agent/code-fixer');
  const config = loadConfig();
  
  const fixer = new CodeFixer({
    dryRun: false,
    createBackup: true,
    autoCommit: false
  });
  
  const fixResults = await fixer.applyFixes(analysisResults);
  
  return fixResults;
}

async function createPR(analysisResults, fixResults) {
  console.log('Creating Pull Request...');
  
  const GitHubPRCreator = require('../ai-agent/github-pr-creator');
  const config = loadConfig();
  
  if (!config.githubToken) {
    console.log('⚠️  No GitHub token configured, skipping PR creation');
    return { success: false, message: 'No GitHub token' };
  }
  
  const prCreator = new GitHubPRCreator(config);
  
  try {
    const prResults = await prCreator.createPR(analysisResults, fixResults);
    return prResults;
  } catch (error) {
    console.error('Failed to create PR:', error.message);
    return { success: false, error: error.message };
  }
}

function loadConfig() {
  const configPath = path.join(process.cwd(), 'ai-agent.config.js');
  
  if (fs.existsSync(configPath)) {
    return require(configPath);
  }
  
  return {
    aiProvider: process.env.AI_PROVIDER || 'sarvam',
    autoAnalyze: true, // Enable automated AI analysis
    apiKey: process.env.SARVAM_API_KEY || process.env.AI_API_KEY,
    model: process.env.AI_MODEL || 'sarvam-m',
    githubToken: process.env.GITHUB_TOKEN
  };
}

// Run the workflow
if (require.main === module) {
  runWorkflow()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ Workflow completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Workflow failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runWorkflow };
