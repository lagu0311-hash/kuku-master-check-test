import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {animalSvg} from '../docs/animals.js';
const here=dirname(fileURLToPath(import.meta.url));

// Scope: only weights and coach were approved for replacement.
for(const kind of ['cat','dog','rabbit','squirrel']){
  for(const pose of ['weights','coach']){
    test(`infographic-derived ${kind}/${pose} sprite is mapped without synthetic accessories`,()=>{
      const html=animalSvg(kind,pose);
      const file=`${kind}-${pose}-alt.webp`;
      assert.ok(html.includes(file));
      assert.ok(existsSync(resolve(here,'../docs/assets/characters',file)));
      assert.doesNotMatch(html,/<svg\b|pose-accessory|cheer-bubble|dog-dumbbell/);
      assert.match(html,new RegExp(`aria-label="(ねこ|いぬ|うさぎ|りす)の${pose==='weights'?'筋トレ':'応援'}"`));
    });
  }
}

test('home/correct animal paths are untouched by the pose-only replacement',()=>{
  assert.match(animalSvg('cat','home'),/cat-home\.webp/);
  for(const pose of ['jump','spin','clap','star'])assert.match(animalSvg('cat',pose),/cat-(jump|clap|star)\.webp/);
  for(const kind of ['dog','rabbit','squirrel']){
    assert.match(animalSvg(kind,'home'),new RegExp(`${kind}-home\\.webp`));
    assert.match(animalSvg(kind,'jump'),new RegExp(`${kind}-home\\.webp`));
  }
  const css=readFileSync(resolve(here,'../docs/styles.css'),'utf8');
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('.animal-scene.still .animal-friend'));
});
