"""Bundle a standalone study with the game's actual procedural library, never booting the game."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
src=(root/'index.html').read_text()
lib=src.split('<script>',1)[1].rsplit('</script>',1)[0]
# Standalone study supplies its own adapter and UI; do not install campaign modules twice.
lib=re.sub(r'/\*SH_REALTIME_(MODEL|VIEW|CAMPAIGN|TACTICS)_START\*/[\s\S]*?/\*SH_REALTIME_\1_END\*/','',lib)
lib,n=re.subn(r'^if \(window\.claude && window\.claude\.hot && window\.claude\.hot\.ready\).*?else boot\(\);\s*$', '',lib,flags=re.M)
assert n==1, 'The game boot hook must be removed exactly once.'
lib+='\nfunction rtBattleChosen(){return false;}\n'
# This silent visual study must not install the game's global audio gesture handlers.
start=lib.index('/* Shinobi Hollow - procedural sound & music (Web Audio only, no assets). */')
end=lib.index('/* ================= VILLAGE: state, simulation, rendering ================= */',start)
lib=lib[:start]+'const Sound={play(){},say(){}};\n'+lib[end:]
assert '</script' not in lib.lower()
bridge=(root/'prototypes/battlefield-25d/asset-bridge.js').read_text()
shell=(root/'prototypes/battlefield-25d/shell.html').read_text()
app=(root/'prototypes/battlefield-25d/preview.js').read_text()
combat=(root/'prototypes/battlefield-25d/combat.js').read_text()
result=shell.replace('/*__PROCEDURAL_LIBRARY__*/','(()=>{\n'+lib+'\n'+bridge+'\n})();').replace('/*__COMBAT_MODEL__*/',combat).replace('/*__PREVIEW_APP__*/',app)
result='\n'.join(line.rstrip() for line in result.splitlines())+'\n'
(root/'prototypes/Shinobi Hollow - Grand Battlefield.html').write_text(result)
print('Built standalone:',len(result.encode()),'bytes; game index.html was not modified.')
