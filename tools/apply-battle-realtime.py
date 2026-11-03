"""Synchronize model/view/adapter blocks. Integration hooks live in index.html."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1];p=root/'index.html';s=p.read_text()
assert '/*BATTLE_RT_INTEGRATED*/' in s, 'Use the integrated standalone source; this tool does not patch older game versions.'
for name,file in [('MODEL','prototypes/battlefield-25d/combat.js'),('VIEW','prototypes/battlefield-25d/renderer.js'),('CAMPAIGN','tools/modules/battle-realtime-campaign.js')]:
 block='/*SH_REALTIME_'+name+'_START*/\n'+(root/file).read_text()+'\n/*SH_REALTIME_'+name+'_END*/'
 pattern=r'/\*SH_REALTIME_'+name+r'_START\*/[\s\S]*?/\*SH_REALTIME_'+name+r'_END\*/'
 if re.search(pattern,s):s=re.sub(pattern,lambda m:block,s)
 else:s=s.replace("if (window.claude && window.claude.hot && window.claude.hot.ready)",block+"\n\nif (window.claude && window.claude.hot && window.claude.hot.ready)",1)
p.write_text(s)
print('Synchronized real-time battle modules into index.html')
