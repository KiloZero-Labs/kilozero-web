import ProbeWorkflowClient from './ProbeWorkflowClient';

export const dynamic = 'force-dynamic';

export default async function ProbeWorkflowPage() {
  // Read the InferenceEngine source at build/request time (server component)
  let engineSource = '';
  let engineError = '';
  let schemaVersion = '';
  let changelog: { version: string; date: string; type: string; summary: string }[] = [];
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const enginePath = path.resolve(
      process.cwd(), 'src', 'lib', 'InferenceEngine.ts'
    );
    engineSource = await fs.readFile(enginePath, 'utf-8');

    // Extract version constant
    const versionMatch = engineSource.match(/INFERENCE_SCHEMA_VERSION\s*=\s*'([^']+)'/);
    if (versionMatch) schemaVersion = versionMatch[1];

    // Extract changelog array (parse the structured entries)
    const changelogMatch = engineSource.match(/INFERENCE_SCHEMA_CHANGELOG[^[]*\[([\s\S]*?)\];/);
    if (changelogMatch) {
      const entries = [...changelogMatch[1].matchAll(/\{\s*version:\s*'([^']+)',\s*date:\s*'([^']+)',\s*type:\s*'([^']+)',\s*summary:\s*'([^']+)'\s*\}/g)];
      changelog = entries.map(m => ({ version: m[1], date: m[2], type: m[3], summary: m[4] }));
    }
  } catch (err: any) {
    engineError = err.message;
  }

  return <ProbeWorkflowClient engineSource={engineSource} engineError={engineError} schemaVersion={schemaVersion} changelog={changelog} />;
}
