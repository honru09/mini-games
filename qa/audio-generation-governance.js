#!/usr/bin/env node
'use strict';

/*
 * Audio candidate governance gate.
 *
 * This is intentionally read-only. It verifies that external generation is
 * still quarantined, that no secret/output is fabricated, and that the public
 * runtime remains on the procedural fallback contract.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'requirements', 'active', 'audio-optimization-mainline-p1-20260817', 'audio-candidate-register.json');
const PREFLIGHT_PATH = path.join(ROOT, 'requirements', 'active', 'audio-optimization-mainline-p1-20260817', 'external-generation-preflight.json');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

let failures = 0;
let assertions = 0;

function check(label, condition, detail) {
  assertions += 1;
  if (condition) {
    process.stdout.write(`PASS  ${label}\n`);
  } else {
    failures += 1;
    process.stderr.write(`FAIL  ${label}${detail ? ` :: ${detail}` : ''}\n`);
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    check(`read ${path.relative(ROOT, file)}`, false, error.message);
    return null;
  }
}

function walkFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(full));
    else result.push({ path: full, symlink: entry.isSymbolicLink() });
  }
  return result;
}

function collectStrings(value, prefix = '$', output = []) {
  if (typeof value === 'string') output.push({ path: prefix, value });
  else if (Array.isArray(value)) value.forEach((item, index) => collectStrings(item, `${prefix}[${index}]`, output));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => collectStrings(item, `${prefix}.${key}`, output));
  return output;
}

const registry = readJson(REGISTRY_PATH);
const preflight = readJson(PREFLIGHT_PATH);
const manifest = readJson(MANIFEST_PATH);

check('candidate registry exists and has current schema', !!registry && registry.schemaVersion === 1 && registry.registryId === 'AUDIO-CANDIDATE-REGISTER-V1');
check('external preflight exists and has current schema', !!preflight && preflight.schemaVersion === 1 && preflight.preflightId === 'AUDIO-EXTERNAL-GENERATION-PREFLIGHT-V1');

const policy = registry && registry.policy;
check('registry keeps all external candidates quarantined', !!policy && policy.externalCandidateStatus === 'PLANNED_NOT_GENERATED' && policy.publicRuntimeGeneration === 'FORBIDDEN' && policy.generatedOutputAdmission === 'MANIFEST_ONLY_AFTER_LICENSE_PROVENANCE_REVIEW');
check('registry requires a procedural fallback', !!policy && policy.fallbackRequired === true && policy.fallbackAssetId === 'AUDIO-FALLBACK-PROCEDURAL-V1');

const candidates = registry && Array.isArray(registry.externalCandidates) ? registry.externalCandidates : [];
const expectedCandidateIds = [
  'AUDIOCRAFT-RESEARCH-SFX-TEXTURE-V1',
  'AUDIOCRAFT-RESEARCH-MUSIC-BED-V1',
  'ELEVENLABS-SFX-CORE-V1',
  'FAL-AUDIO-SFX-VARIANTS-V1',
  'GAME-CREATOR-PROCEDURAL-DESIGN-REFERENCE-V1'
];
check('registry contains exactly the five reviewed candidate/reference records', candidates.length === expectedCandidateIds.length);
const candidateIds = candidates.map(candidate => candidate && candidate.candidateId);
check('candidate IDs are the exact frozen set', candidateIds.length === new Set(candidateIds).size && expectedCandidateIds.every(id => candidateIds.includes(id)) && candidateIds.every(id => expectedCandidateIds.includes(id)));

const expectedProviders = new Set(['audiocraft', 'elevenlabs', 'fal-ai', 'game-creator']);
check('registry covers each selected provider/workflow', [...expectedProviders].every(provider => candidates.some(candidate => candidate.provider === provider)));

const generationCandidates = candidates.filter(candidate => candidate && candidate.candidateType === 'external-generation');
check('registry distinguishes four generation candidates from one design reference', generationCandidates.length === 4 && candidates.filter(candidate => candidate && candidate.candidateType === 'design-reference').length === 1);

for (const candidate of generationCandidates) {
  const id = candidate && candidate.candidateId ? candidate.candidateId : '<missing-id>';
  check(`${id} is an external planned candidate`, !!candidate && candidate.candidateType === 'external-generation' && candidate.status === 'PLANNED_NOT_GENERATED');
  check(`${id} has cue scope and no user-data prompt inputs`, !!candidate && Array.isArray(candidate.plannedCues) && candidate.plannedCues.length > 0 && (!candidate.promptTemplate || !/[<{](?:uid|user|username|message|text|token|secret|password)[}>]/i.test(candidate.promptTemplate)));
  const output = candidate && candidate.generation;
  check(`${id} has an explicit not-generated output record`, !!output && output.status === 'NOT_GENERATED' && output.artifactPath === null && output.sha256 === null && output.bytes === null && output.providerJobId === null && output.generatedAt === null);
  const runtime = candidate && candidate.runtime;
  check(`${id} is feature-flagged off with procedural fallback`, !!runtime && runtime.defaultEnabled === false && runtime.fallbackAssetId === 'AUDIO-FALLBACK-PROCEDURAL-V1' && runtime.publicPath === null && runtime.manifestAssetId === null);
  check(`${id} has a reversible rollback contract`, !!candidate && candidate.rollback && candidate.rollback.removeFromManifest === true && candidate.rollback.fallback === 'AUDIO-FALLBACK-PROCEDURAL-V1');
}

const gameCreatorReference = candidates.find(candidate => candidate && candidate.candidateId === 'GAME-CREATOR-PROCEDURAL-DESIGN-REFERENCE-V1');
check('game-creator is a source-only design reference, not a fake generator', !!gameCreatorReference && gameCreatorReference.candidateType === 'design-reference' && gameCreatorReference.status === 'REFERENCE_ONLY' && gameCreatorReference.generation && gameCreatorReference.generation.status === 'NOT_APPLICABLE_REFERENCE_ONLY');
check('game-creator reference has no runtime candidate flag or manifest mutation', !!gameCreatorReference && gameCreatorReference.runtime && !Object.prototype.hasOwnProperty.call(gameCreatorReference.runtime, 'featureFlag') && gameCreatorReference.runtime.publicPath === null && gameCreatorReference.runtime.manifestAssetId === null && gameCreatorReference.rollback && gameCreatorReference.rollback.runtimeChangeRequired === false && gameCreatorReference.rollback.removeFromManifest === false);

const expectedSourceLocks = [
  {
    sourceId: 'GAME-CREATOR-DESIGN-REFERENCE',
    sourceUrl: 'https://github.com/PlayableIntelligence/game-creator',
    revision: '4e64b83b5fe400b34ad3a484d9b4a6090b26d512',
    candidateIds: ['GAME-CREATOR-PROCEDURAL-DESIGN-REFERENCE-V1'],
    skills: {
      'add-audio': '49E4D8C0C7135B42936C3E2E0022F7B571EDCFC36CBC9770D1ED18A7CB37C9FD',
      'game-audio': 'A5244D0136F98A729C9E5454741A4E76F5F16C34E06877C3D64DDB5A2A4AB4B5'
    }
  },
  {
    sourceId: 'AUDIOCRAFT-CODE-REPOSITORY',
    sourceUrl: 'https://github.com/facebookresearch/audiocraft',
    revision: '896ec7c47f5e5d1e5aa1e4b260c4405328bf009d',
    candidateIds: ['AUDIOCRAFT-RESEARCH-SFX-TEXTURE-V1', 'AUDIOCRAFT-RESEARCH-MUSIC-BED-V1'],
    skills: {}
  },
  {
    sourceId: 'HERMES-AUDIOCRAFT-WORKFLOW-SKILL',
    sourceUrl: 'https://github.com/NousResearch/hermes-agent/blob/main/optional-skills/creative/audiocraft-audio-generation/SKILL.md',
    revision: '4323c67dcc6048fc8e311cdff7600d3d6a17807f',
    candidateIds: ['AUDIOCRAFT-RESEARCH-SFX-TEXTURE-V1', 'AUDIOCRAFT-RESEARCH-MUSIC-BED-V1'],
    skills: { 'audiocraft-audio-generation': 'A2F1C3B8B5D9C89E06CE7927D1A62E0CC5813A5F5DD63D81637A3C317665D002' }
  },
  {
    sourceId: 'ECC-FAL-AI-MEDIA-WORKFLOW-SKILL',
    sourceUrl: 'https://github.com/affaan-m/ECC/blob/main/.agents/skills/fal-ai-media/SKILL.md',
    revision: '06c5e118c4d3e6c3b7f9445f973a2194c82de193',
    candidateIds: ['FAL-AUDIO-SFX-VARIANTS-V1'],
    skills: { 'fal-ai-media': '2420F083FDF4EEC3BB97B9B5DB8B68E667640B51ECA051C7D537596E6BE2049C' }
  },
  {
    sourceId: 'ELEVENLABS-SOUND-EFFECTS-WORKFLOW-SKILL',
    sourceUrl: 'https://github.com/elevenlabs/skills/tree/main/sound-effects',
    revision: '1d8a5c6cc1edf0b22df34620b9d5a1324a8d9f0a',
    candidateIds: ['ELEVENLABS-SFX-CORE-V1'],
    skills: { 'sound-effects': '9DA7F48812A55A6569893E900CB43D4088201E21CF38D7B12EDA55E63F1DC12A' }
  }
];
const sourceLocks = registry && Array.isArray(registry.sourceLocks) ? registry.sourceLocks : [];
check('all five user-requested upstream sources are revision-locked', sourceLocks.length === expectedSourceLocks.length && expectedSourceLocks.every(expected => {
  const actual = sourceLocks.find(item => item && item.sourceId === expected.sourceId);
  return actual && actual.sourceUrl === expected.sourceUrl && actual.revision === expected.revision && /^[a-f0-9]{40}$/.test(actual.revision) && typeof actual.pinnedUrl === 'string' && actual.pinnedUrl.includes(actual.revision) && JSON.stringify(actual.candidateIds) === JSON.stringify(expected.candidateIds);
}));
check('workflow source locks retain exact local SKILL.md hashes', expectedSourceLocks.every(expected => {
  const actual = sourceLocks.find(item => item && item.sourceId === expected.sourceId);
  const snapshots = actual && Array.isArray(actual.localSkillSnapshots) ? actual.localSkillSnapshots : [];
  return Object.entries(expected.skills).every(([name, hash]) => snapshots.some(snapshot => snapshot && snapshot.skillName === name && snapshot.sha256 === hash && /^\$CODEX_HOME\/skills\/.+\/SKILL\.md$/.test(snapshot.localPath)));
}));
check('every candidate maps only to its frozen source lock IDs', candidates.every(candidate => {
  if (!candidate || !Array.isArray(candidate.sourceLockIds) || !candidate.sourceLockIds.length) return false;
  return candidate.sourceLockIds.every(sourceId => sourceLocks.some(lock => lock && lock.sourceId === sourceId && Array.isArray(lock.candidateIds) && lock.candidateIds.includes(candidate.candidateId)));
}));

const audioCraft = candidates.filter(candidate => candidate.provider === 'audiocraft');
check('AudioCraft candidates are research-only', audioCraft.length > 0 && audioCraft.every(candidate => candidate.researchOnly === true && candidate.licenseGate && candidate.licenseGate.modelWeights === 'CC-BY-NC-4.0' && candidate.licenseGate.commercialUse === 'BLOCKED' && candidate.licenseGate.runtimeAdmission === 'RESEARCH_ONLY_UNTIL_INDEPENDENT_LICENSE_CLEARANCE'));
check('AudioCraft public checkpoints do not fabricate a required HF token', audioCraft.length === 2 && audioCraft.every(candidate => candidate.credentialGate && Array.isArray(candidate.credentialGate.requiredEnvironment) && candidate.credentialGate.requiredEnvironment.length === 0 && Array.isArray(candidate.credentialGate.optionalEnvironment) && candidate.credentialGate.optionalEnvironment.includes('HF_TOKEN') && candidate.credentialGate.observedStatus === 'OPTIONAL_ABSENT_NON_BLOCKING'));
check('AudioCraft native 16/32 kHz outputs have explicit 44.1 kHz resample provenance', audioCraft.length === 2 && audioCraft.every(candidate => {
  const expectedNative = candidate.mode === 'AudioGen' ? 16000 : candidate.mode === 'MusicGen' ? 32000 : null;
  const plan = candidate.generationPlan;
  const resample = plan && plan.resample;
  const provenance = candidate.generation && candidate.generation.provenance;
  return expectedNative && plan.nativeSampleRateHz === expectedNative && plan.deliverySampleRateHz === 44100 && resample && resample.status === 'PLANNED_NOT_EXECUTED' && resample.sourceSampleRateHz === expectedNative && resample.targetSampleRateHz === 44100 && resample.retainNativeSource === true && Array.isArray(resample.provenanceFieldsRequired) && resample.provenanceFieldsRequired.includes('nativeArtifactSha256') && resample.provenanceFieldsRequired.includes('deliveryArtifactSha256') && provenance && Object.values(provenance).every(value => value === null);
}));
const elevenLabs = candidates.filter(candidate => candidate.provider === 'elevenlabs');
check('ElevenLabs candidate records missing credential and request', elevenLabs.length > 0 && elevenLabs.every(candidate => candidate.credentialGate && candidate.credentialGate.observedStatus === 'MISSING' && candidate.credentialGate.requiredEnvironment.includes('ELEVENLABS_API_KEY') && candidate.credentialGate.generationRequestStatus === 'NOT_EXECUTED'));
const fal = candidates.filter(candidate => candidate.provider === 'fal-ai');
check('fal candidate records missing credential and MCP', fal.length > 0 && fal.every(candidate => candidate.credentialGate && candidate.credentialGate.observedStatus === 'MISSING' && candidate.credentialGate.mcpRequired === true && candidate.credentialGate.mcpObservedStatus === 'UNAVAILABLE' && candidate.credentialGate.generationRequestStatus === 'NOT_EXECUTED'));

const registryText = registry ? JSON.stringify(registry) : '';
const secretLikePatterns = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /(?:FAL_KEY|ELEVENLABS_API_KEY|HF_TOKEN|HUGGINGFACE_HUB_TOKEN)\s*[:=]\s*["'][^"']+["']/i,
  /Bearer\s+[A-Za-z0-9._-]{20,}/i
];
check('registry contains no secret values', secretLikePatterns.every(pattern => !pattern.test(registryText)));
check('registry does not fabricate output hashes or paths', candidates.every(candidate => candidate.generation && candidate.generation.sha256 === null && candidate.generation.artifactPath === null && candidate.runtime && candidate.runtime.publicPath === null));

const providers = preflight && preflight.providers;
check('preflight records generators as not executed and game-creator as reference-only', !!providers && ['audiocraft', 'elevenlabs', 'fal-ai'].every(provider => providers[provider] && providers[provider].generationStatus === 'NOT_EXECUTED') && providers['game-creator'] && providers['game-creator'].generationStatus === 'NOT_APPLICABLE_REFERENCE_ONLY');
check('preflight records credential presence without values', !!preflight && preflight.observedSecrets && preflight.observedSecrets.recordedValues === false && preflight.observedSecrets.FAL_KEY === false && preflight.observedSecrets.ELEVENLABS_API_KEY === false && preflight.observedSecrets.HF_TOKEN === false && preflight.observedSecrets.HUGGINGFACE_HUB_TOKEN === false);
check('preflight records missing AudioCraft environment without treating optional token as blocker', !!providers && providers.audiocraft && providers.audiocraft.dependenciesReady === false && providers.audiocraft.licenseStatus === 'RESEARCH_ONLY_CC_BY_NC_4_0' && Array.isArray(providers.audiocraft.requiredCredentialNames) && providers.audiocraft.requiredCredentialNames.length === 0 && providers.audiocraft.publicCheckpointAuthentication === 'OPTIONAL_NON_BLOCKING' && providers.audiocraft.nativeOutputPlan && providers.audiocraft.nativeOutputPlan.resampleStatus === 'PLANNED_NOT_EXECUTED');
check('preflight records missing fal and ElevenLabs credentials', !!providers && providers['fal-ai'] && providers['fal-ai'].credentialPresent === false && providers['fal-ai'].mcpAvailable === false && providers.elevenlabs && providers.elevenlabs.credentialPresent === false);
check('preflight has no generated output or provider job IDs', !!preflight && preflight.generationAudit && preflight.generationAudit.requestsSent === false && Array.isArray(preflight.generationAudit.providerJobIds) && preflight.generationAudit.providerJobIds.length === 0 && Array.isArray(preflight.generationAudit.outputs) && preflight.generationAudit.outputs.length === 0 && Array.isArray(preflight.generationAudit.outputHashes) && preflight.generationAudit.outputHashes.length === 0);

const audioExtensions = /\.(?:wav|mp3|ogg|m4a|aac|flac|opus|webm)$/i;
const publicAudioFiles = walkFiles(PUBLIC_DIR).filter(entry => audioExtensions.test(entry.path));
check('public contains no unapproved audio binary', publicAudioFiles.length === 0, publicAudioFiles.map(entry => path.relative(ROOT, entry.path)).join(', '));

const manifestStrings = manifest ? collectStrings(manifest) : [];
const manifestAudioRefs = manifestStrings.filter(item => audioExtensions.test(item.value));
check('asset manifest contains no unapproved audio file reference', manifestAudioRefs.length === 0, manifestAudioRefs.map(item => `${item.path}=${item.value}`).join(', '));
const games = manifest && Array.isArray(manifest.games) ? manifest.games : [];
const expectedGames = ['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'];
check('manifest lists exactly the six game audio contracts', games.length === expectedGames.length && expectedGames.every(id => games.some(game => game.runtime_id === id)));
check('all six games retain procedural audio and fallback metadata', games.length === expectedGames.length && expectedGames.every(id => {
  const game = games.find(item => item.runtime_id === id);
  return game && game.audio === 'unified-procedural-v1' && game.audio_fallback === 'webaudio-fallback';
}));

const publicTextFiles = walkFiles(PUBLIC_DIR).filter(entry => /\.(?:js|json|html|css|md|webmanifest)$/i.test(entry.path));
const runtimeProviderPatterns = [
  /facebookresearch\/audiocraft/i,
  /\baudiocraft\b/i,
  /\b(?:musicgen|audiogen)\b/i,
  /\belevenlabs\b/i,
  /\bfal\.ai\b/i,
  /\b(?:FAL_KEY|ELEVENLABS_API_KEY|HF_TOKEN|HUGGINGFACE_HUB_TOKEN)\b/i,
  /\bCC-BY-NC(?:-4\.0)?\b/i
];
const providerLeaks = [];
const promptLeaks = [];
const promptMarkers = candidates
  .map(candidate => candidate && typeof candidate.promptTemplate === 'string' ? candidate.promptTemplate.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim() : '')
  .filter(marker => marker.length >= 24);
for (const entry of publicTextFiles) {
  let source;
  try { source = fs.readFileSync(entry.path, 'utf8'); } catch { continue; }
  for (const pattern of runtimeProviderPatterns) {
    if (pattern.test(source)) {
      providerLeaks.push(`${path.relative(ROOT, entry.path)}:${pattern}`);
      break;
    }
  }
  for (const marker of promptMarkers) {
    if (source.includes(marker)) {
      promptLeaks.push(`${path.relative(ROOT, entry.path)}:${marker.slice(0, 40)}`);
      break;
    }
  }
}
check('provider SDK names, credentials and candidate licenses stay out of public runtime', providerLeaks.length === 0, providerLeaks.slice(0, 5).join(', '));
check('external candidate prompt templates stay out of public runtime', promptLeaks.length === 0, promptLeaks.slice(0, 5).join(', '));

const baseline = registry && registry.runtimeBaseline;
check('registry baseline points at the project-owned procedural adapter', !!baseline && baseline.assetId === 'AUDIO-FALLBACK-PROCEDURAL-V1' && baseline.status === 'INTEGRATED_FALLBACK' && baseline.provider === 'internal-web-audio' && baseline.manifestContract && baseline.manifestContract.externalNetwork === false);

const summary = {
  assertions,
  failures,
  candidateCount: candidates.length,
  publicAudioFiles: publicAudioFiles.length,
  manifestAudioReferences: manifestAudioRefs.length,
  providerLeaks: providerLeaks.length,
  promptLeaks: promptLeaks.length,
  generatedOutputs: preflight && preflight.generationAudit ? preflight.generationAudit.outputs.length : null
};
if (failures) {
  process.stderr.write(`AUDIO_GENERATION_GOVERNANCE_FAILED ${JSON.stringify(summary)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`AUDIO_GENERATION_GOVERNANCE_ALL_PASS ${JSON.stringify(summary)}\n`);
}
