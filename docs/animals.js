// Approved home/success characters remain unchanged. For weights/coach only,
// use the eight watercolor poses directly cropped from the owner-selected graphic.
const NAMES = {cat:'ねこ',dog:'いぬ',rabbit:'うさぎ',squirrel:'りす'};
const SPRITES = Object.freeze({
  cat:Object.freeze({
    home:'cat-home.webp', jump:'cat-jump.webp', spin:'cat-jump.webp',
    clap:'cat-clap.webp', star:'cat-star.webp',
    weights:'cat-weights-alt.webp',coach:'cat-coach-alt.webp'
  }),
  dog:Object.freeze({default:'dog-home.webp',weights:'dog-weights-alt.webp',coach:'dog-coach-alt.webp'}),
  rabbit:Object.freeze({default:'rabbit-home.webp',weights:'rabbit-weights-alt.webp',coach:'rabbit-coach-alt.webp'}),
  squirrel:Object.freeze({default:'squirrel-home.webp',weights:'squirrel-weights-alt.webp',coach:'squirrel-coach-alt.webp'})
});
export function animalSvg(type='cat',pose='jump') {
  const kind=Object.hasOwn(SPRITES,type)?type:'cat';
  const validPose=['home','jump','spin','clap','star','weights','coach'].includes(pose)?pose:'jump';
  const file=SPRITES[kind][validPose]??SPRITES[kind].default;
  const description=validPose==='weights'?'の筋トレ':validPose==='coach'?'の応援':'のイラスト';
  return `<span class="animal animal-${kind} pose-${validPose}" role="img" aria-label="${NAMES[kind]}${description}">
    <span class="animal-friend"><img src="./assets/characters/${file}" alt="" draggable="false"></span>
  </span>`;
}
