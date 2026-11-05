// One definition of where the Angular build lands, read out of angular.json rather than repeated
// as a string in the serve script, the Pages post-build and the workflows.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const angularJson = JSON.parse(readFileSync(join(REPO_ROOT, 'angular.json'), 'utf8'));
const [projectName, project] = Object.entries(angularJson.projects)[0];
const configuredOutputPath = project.architect.build.options.outputPath;

export const PROJECT_NAME = projectName;
export const OUTPUT_DIR = resolve(REPO_ROOT, configuredOutputPath ?? join('dist', projectName));
export const BROWSER_DIST_DIR = join(OUTPUT_DIR, 'browser');
