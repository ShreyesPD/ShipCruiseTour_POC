#!/usr/bin/env node
/**
 * Creates Jira issues from Playwright test-results.json failures.
 * Updates the Jira board via REST API when tests run (npm start).
 * Requires .env: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY
 */

const fs = require('fs');
const path = require('path');

function stripAnsi(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Extract failed test cases from Playwright test-results.json
 */
function getFailedTests(resultsPath) {
  if (!fs.existsSync(resultsPath)) return [];
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
  const failures = [];

  function walk(suites, suiteTitle = '', suiteFile = '') {
    if (!Array.isArray(suites)) return;
    for (const suite of suites) {
      const title = suite.title || suiteTitle;
      const file = suite.file || suiteFile;
      if (suite.specs && Array.isArray(suite.specs)) {
        for (const spec of suite.specs) {
          const specTitle = spec.title || '';
          if (spec.tests && Array.isArray(spec.tests)) {
            for (const test of spec.tests) {
              const resultsList = test.results || [];
              const failedResult = resultsList.find(r => ['failed', 'timedOut', 'interrupted'].includes(r.status));
              if (!failedResult) continue;
              const err = failedResult.error || {};
              const message = err.message || err.stack || (failedResult.errors && failedResult.errors[0] && failedResult.errors[0].message) || 'Test failed';
              failures.push({
                suite: title,
                file: file,
                spec: specTitle,
                testTitle: specTitle,
                error: stripAnsi(String(message)).substring(0, 3000)
              });
            }
          }
        }
      }
      if (suite.suites) walk(suite.suites, title, file);
    }
  }

  if (results.suites) walk(results.suites);
  return failures;
}

/**
 * Create a single Jira issue via REST API v3
 */
async function createJiraIssue(config, payload) {
  const baseUrl = (config.jiraBaseUrl || '').replace(/\/$/, '');
  const email = config.jiraEmail;
  const apiToken = config.jiraApiToken;
  const projectKey = config.jiraProjectKey || 'MSCSHIP';

  if (!baseUrl || !email || !apiToken || !projectKey) {
    throw new Error('Jira config missing: set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY in .env');
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const url = `${baseUrl}/rest/api/3/issue`;
  const body = {
    fields: {
      project: { key: projectKey },
      summary: payload.summary.substring(0, 255),
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: payload.description || 'No details.' }]
          }
        ]
      },
      issuetype: { name: payload.issueType || 'Bug' }
    }
  };

  const fetch = (await import('node-fetch')).default;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    let errJson;
    try { errJson = JSON.parse(errText); } catch (_) {}
    const msg = errJson && errJson.errorMessages ? errJson.errorMessages.join('; ') : errText;
    throw new Error(`Jira API ${res.status}: ${msg}`);
  }

  const data = await res.json();
  return { key: data.key, id: data.id, url: `${baseUrl}/browse/${data.key}` };
}

/**
 * Create Jira issues for all failed tests and optionally one summary issue
 */
async function createJiraTicketsFromTestResults(config, resultsPath) {
  const failed = getFailedTests(resultsPath);
  if (failed.length === 0) {
    return { created: 0, keys: [], message: 'No failed tests to report' };
  }

  const created = [];
  const issueType = config.jiraIssueType || 'Bug';

  for (const f of failed) {
    const summary = `[Test] ${f.spec || f.suite} – ${f.testTitle || 'Failed'}`.substring(0, 255);
    const description = [
      `Suite: ${f.suite}`,
      `File: ${f.file}`,
      `Spec: ${f.spec}`,
      '',
      'Error:',
      f.error
    ].join('\n');

    try {
      const issue = await createJiraIssue(config, {
        summary,
        description,
        issueType
      });
      created.push(issue);
    } catch (err) {
      console.error(`Failed to create Jira issue for "${f.testTitle}":`, err.message);
    }
  }

  return {
    created: created.length,
    keys: created.map(c => c.key),
    urls: created.map(c => c.url),
    message: created.length ? `Created ${created.length} Jira issue(s)` : 'No issues created (API errors)'
  };
}

async function run() {
  require('dotenv').config();
  const projectRoot = path.resolve(__dirname, '..');
  const resultsPath = path.join(projectRoot, 'test-results.json');

  const config = {
    jiraBaseUrl: process.env.JIRA_BASE_URL,
    jiraEmail: process.env.JIRA_EMAIL,
    jiraApiToken: process.env.JIRA_API_TOKEN,
    jiraProjectKey: process.env.JIRA_PROJECT_KEY,
    jiraIssueType: process.env.JIRA_ISSUE_TYPE || 'Bug'
  };

  if (!config.jiraBaseUrl || !config.jiraEmail || !config.jiraApiToken || !config.jiraProjectKey) {
    console.warn('⚠️  Jira not configured. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY in .env to create tickets.');
    return { created: 0, keys: [] };
  }

  const result = await createJiraTicketsFromTestResults(config, resultsPath);
  return result;
}

if (require.main === module) {
  run()
    .then((r) => {
      console.log(r.message);
      if (r.urls && r.urls.length) r.urls.forEach(u => console.log('  ', u));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { createJiraTicketsFromTestResults, getFailedTests, run };
