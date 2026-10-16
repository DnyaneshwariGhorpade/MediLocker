const fs = require('fs');

function patchFile(file, searchStr, replaceStr) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(searchStr)) {
    fs.writeFileSync(file, content.replace(searchStr, replaceStr), 'utf8');
    console.log(`Patched ${file}`);
  } else {
    console.log(`Search string not found in ${file}`);
  }
}

// Fix HospitalApiConsole.tsx
patchFile(
  'frontend/src/pages/HospitalApiConsole.tsx',
  '<span className="font-mono">{c.api_key_hash.substring(0,10)}...</span>',
  '<span className="font-mono">{c.api_key_hash ? `${c.api_key_hash.substring(0,10)}...` : \'—\'}</span>'
);

patchFile(
  'frontend/src/pages/HospitalApiConsole.tsx',
  'defaultValue={c.allowed_ip_cidrs.join(\', \')}',
  'defaultValue={(c.allowed_ip_cidrs || []).join(\', \')}'
);
