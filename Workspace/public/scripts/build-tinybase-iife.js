import { readFileSync, writeFileSync } from 'fs';

function wrapAsIife(sourcePath, globalName) {
  let code = readFileSync(sourcePath, 'utf8');
  const exportMatch = code.match(/\bexport\s*\{([\s\S]*?)\}\s*;?\s*(?:\/\/#\s*sourceMappingURL=\S+\s*)?$/);
  console.log(`  ${sourcePath}: exportMatch=${exportMatch ? 'yes' : 'no'}`);
  let globalAssignments = '';
  if (exportMatch) {
    const exports = exportMatch[1];
    const assignments = exports.split(',').map(s => {
      const trimmed = s.trim();
      const aliasMatch = trimmed.match(/(\w+)\s+as\s+(\w+)/);
      if (aliasMatch) {
        return `${aliasMatch[2]}: ${aliasMatch[1]}`;
      }
      return `${trimmed}: ${trimmed}`;
    }).join(',\n    ');
    globalAssignments = `\nglobal.${globalName} = {\n    ${assignments}\n};\n`;
    code = code.replace(/\bexport\s*\{[\s\S]*?\}\s*;?\s*(?:\/\/#\s*sourceMappingURL=\S+\s*)?$/, '');
  } else {
    globalAssignments = `\nglobal.${globalName} = global.${globalName} || {};\n`;
    code = code.replace(/\/\/#\s*sourceMappingURL=\S+\s*$/, '');
  }
  const iife = `(function(global){
${code}
${globalAssignments}
})(globalThis);
`;
  return iife;
}

const tb = wrapAsIife('node_modules/tinybase/min/index.js', 'TinyBase');
writeFileSync('WorkspaceShared/tinybase.iife.js', tb);

const pkClient = wrapAsIife('node_modules/tinybase/min/persisters/persister-partykit-client/index.js', 'TinyBasePersisterPartyKitClient');
writeFileSync('WorkspaceShared/tinybase-partykit.iife.js', pkClient);

const pkServer = wrapAsIife('node_modules/tinybase/min/persisters/persister-partykit-server/index.js', 'TinyBasePersisterPartyKitServer');
writeFileSync('WorkspaceShared/tinybase-partykit-server.iife.js', pkServer);

const wsClient = wrapAsIife('node_modules/tinybase/min/synchronizers/synchronizer-ws-client/index.js', 'TinyBaseSynchronizerWsClient');
writeFileSync('WorkspaceShared/tinybase-ws-client.iife.js', wsClient);

const wsServer = wrapAsIife('node_modules/tinybase/min/synchronizers/synchronizer-ws-server/index.js', 'TinyBaseSynchronizerWsServer');
writeFileSync('WorkspaceShared/tinybase-ws-server.iife.js', wsServer);

const ps = wrapAsIife('node_modules/partysocket/dist/index.js', 'PartySocket');
writeFileSync('WorkspaceShared/partysocket.iife.js', ps);

console.log('Built TinyBase IIFE bundles:');
console.log('  - WorkspaceShared/tinybase.iife.js');
console.log('  - WorkspaceShared/tinybase-partykit.iife.js');
console.log('  - WorkspaceShared/tinybase-partykit-server.iife.js');
console.log('  - WorkspaceShared/tinybase-ws-client.iife.js');
console.log('  - WorkspaceShared/tinybase-ws-server.iife.js');
console.log('  - WorkspaceShared/partysocket.iife.js');
