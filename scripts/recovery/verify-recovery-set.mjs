/**
 * Offline ciphertext coverage/integrity check. NO database or Storage network calls,
 * decryption, export, or restore. It does not establish authenticity of the manifest.
 * Separately verify an owner-signed detached GPG manifest signature.
 */
import {promises as fs, constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, dirname, basename, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const requiredComponents = Object.freeze([
  'application','auth-identities','storage-metadata','storage-objects','configuration'
]);
const allowedRootKeys = new Set(['format','version','created_utc','components']);
const allowedComponentKeys = new Set(['file','sha256','bytes']);
const strictFile = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,190}\.gpg$/;
const digestPattern = /^[0-9a-f]{64}$/;

function exactKeys(data, expected, label) {
  if(!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid '+label);
  for(const key of Object.keys(data)) {
    if(!expected.has(key)) throw Error('Unexpected field in '+label);
  }
}
export function validateManifest(manifest) {
  exactKeys(manifest, allowedRootKeys, 'manifest');
  if(manifest.format!=='dawney-recovery-set' || manifest.version!==1 ||
     typeof manifest.created_utc!=='string' ||
     !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(manifest.created_utc) ||
     !Number.isFinite(Date.parse(manifest.created_utc))) {
    throw Error('Unsupported recovery manifest format/date');
  }
  exactKeys(manifest.components, new Set(requiredComponents), 'components');
  if(Object.keys(manifest.components).length!==requiredComponents.length) {
    throw Error('Recovery set is missing a required component');
  }
  const seen = new Set();
  for(const name of requiredComponents) {
    const item=manifest.components[name];
    exactKeys(item,allowedComponentKeys,'component');
    if(typeof item.file!=='string' || !strictFile.test(item.file) ||
       item.file==='.' || item.file==='..' || basename(item.file)!==item.file ||
       seen.has(item.file)) throw Error('Unsafe or duplicate encrypted component name');
    if(typeof item.sha256!=='string' || !digestPattern.test(item.sha256) ||
       !Number.isSafeInteger(item.bytes) || item.bytes<1) {
      throw Error('Invalid recovery component checksum/size');
    }
    seen.add(item.file);
  }
  return manifest;
}

export async function verifyRecoverySet(manifestPath) {
  const file=resolve(manifestPath);
  const manifestStat=await fs.lstat(file);
  if(!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size>32768) {
    throw Error('Recovery manifest must be a normal small local file');
  }
  const manifest=validateManifest(JSON.parse(await fs.readFile(file,'utf8')));
  const folder=dirname(file);
  let checked=0, totalBytes=0;
  for(const name of requiredComponents) {
    const record=manifest.components[name];
    // Names cannot contain slashes or parent navigation; reject symlinks even
    // for files replaced after lstat by using O_NOFOLLOW on open.
    const filename=join(folder,record.file);
    const fd=await fs.open(filename,constants.O_RDONLY|constants.O_NOFOLLOW);
    try {
      const info=await fd.stat();
      if(!info.isFile() || info.size!==record.bytes || info.size===0) {
        throw Error('Recovery encrypted component is missing/size mismatch: '+name);
      }
      const checksum=createHash('sha256');
      for await(const block of fd.createReadStream({autoClose:false})) checksum.update(block);
      if(checksum.digest('hex')!==record.sha256) {
        throw Error('Recovery encrypted component checksum mismatch: '+name);
      }
      checked++;totalBytes+=record.bytes;
    } finally {await fd.close();}
  }
  return {checked,totalBytes};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if(process.argv.length!==3) throw Error('Usage: verify-recovery-set.mjs /private/recovery-set.json');
    const result=await verifyRecoverySet(process.argv[2]);
    console.log('PASS: '+result.checked+' encrypted recovery components checked by SHA-256 ('+result.totalBytes+' bytes).');
    console.log('Integrity alone does NOT prove completeness, manifest authenticity or a successful restore.');
  } catch(error) {
    console.error('Recovery set verification failed: '+(error instanceof Error?error.message:'unknown'));
    process.exitCode=1;
  }
}
