#!/usr/bin/env node
/* A builder, not a check: the text fixes, and on top of them the opening of
   the game -- the dream's two speakers, Alaric's first speech, Magpie's
   greetings and Omen's first two visions, up to the start of Omen's Test --
   rewritten in over-the-top Australian slang. (24 September 2026, at the
   maintainer's word; a variant for fun, not a fix.)

   Usage: node utilities/strine_opening_patch.mjs index.html "<Cythera Data.data>" <out dir>

   Each rewrite replaces a whole string, matched in full as the text fixes
   leave it, so that a click mark (*), a highlighted word (@Cythera, @bond,
   @Mater Theia) and the line breaks stay exactly where the script expects
   them; the keywords are untouched, so every topic is still reached. */
import {fileURLToPath} from 'node:url';
import {buildPatch} from './patch_build.mjs';
import {T, textFixEdits} from './text_fixes_patch.mjs';

const STRINE = [
  T('the dream, Magpie', 0x0240,
    '"It is good - our savior stirs," says a hunchbacked fool, dressed in motley.  He turns to his companion, a taller, distinguished older man, whose face is both timeless and yet bears the toll of an unknown number of years.',
    '"Strewth, she\'s apples - our bloody savior\'s stirrin\'," says a hunchbacked galah, dressed in motley like he\'s off to the Melbourne Cup.  He turns to his cobber, a taller, distinguished old bloke whose face is both timeless and yet looks like it\'s been flat out like a lizard drinking for a good few hundred years.', 1),
  T('the dream, Alaric', 0x0240,
    '"Yes Magpie, it is good.  I hope you are right - I am severely weakened.  To have cast so far, across so much, for this one, I just don\'t know."',
    '"Too right, Magpie, she\'s apples.  Reckon you\'re onto it, mate - but I\'m buggered, absolutely knackered.  Chuckin\' a spell that far, across all that, for this one drongo... yeah nah, I dunno, mate."', 1),
  T('the dream, Magpie again', 0x0240,
    '"Trust Magpie, you must - has the counsel of Magpie ever been wrong?  The choice was a good one, the risk worth the reward.  This was your last best chance for regaining your power, and saving the land from being destroyed.  Much rests on the shoulders of this young one, but the choice was good."',
    '"Trust Magpie, ya must - has Magpie ever steered ya crook?  Fair dinkum, the pick was a beauty, worth the punt.  This was your last best crack at gettin\' your mojo back and stoppin\' the whole joint goin\' to the pack.  Bloody big load on this young one\'s shoulders, but the pick was a ripper."', 1),
  T('Alaric’s first speech', 0x1802,
    '"Ah - good, you are about.  We were worried that you were harmed."*"I suppose I should explain what happened.  My name is Alaric and you are now in the land of @Cythera."*"You were summoned in a final, desperate attempt to save Cythera and its ruler from chaos and madness."*"I am that ruler, and I have a special @bond with the land and the people of Cythera.  For over two hundred years I have used my magic to keep it prosperous."*"Unfortunately, over the past couple of years, my power has waned, and with it, Cythera has started slipping into chaos."*"It is as if that bond were dissolving, the land somehow changing. I do not understand it."*"The more impotent I become, the more frustrating it is to see it all slipping away, like waking from a dream..."*"I have trusted the fates to summon an outsider, from @Mater Theia herself, for only an outsider will be able to see through this cloud that blocks my vision."*"You, of course, are that outsider.  Do not think that I did this on a whim - it has cost me most of my remaining power to do so."*"I must trust you to help me.  I am sorry for the danger this costs you, but you are my, and Cythera\'s, last chance."',
    '"G\'day! Beauty, you\'re up and about.  We were spewin\' that you\'d carked it."*"S\'pose I\'d better spill the beans.  Name\'s Alaric, and you\'re now in the land of @Cythera, mate - no worries."*"You got summoned in a last-ditch, arse-about, hail-Mary attempt to save Cythera and its ruler from goin\' completely troppo."*"I\'m that ruler, and I\'ve got a special @bond with the land and the people of Cythera.  For over two hundred years I\'ve used me magic to keep the joint sweet as."*"Unfortunately, the last coupla years me mojo\'s gone walkabout, and with it Cythera\'s started goin\' to the dogs."*"It\'s like that bond\'s dissolvin\', the land\'s gone all crook somehow. Buggered if I know why."*"The more useless I get, the more it gives me the irrits watchin\' it all slip away, like wakin\' up from a bender..."*"I trusted the fates to summon an outsider, from @Mater Theia herself, \'cause only an outsider\'ll see through this fog that\'s got me stuffed."*"You, obviously, are that outsider.  Don\'t reckon I did this on a whim - it cost me most of me remainin\' power, fair dinkum."*"I gotta trust ya to help me out.  Sorry about the strife this\'ll land ya in, but you\'re my, and Cythera\'s, last chance, cobber."', 1),
  T('Magpie on the throne', 0x1803,
    'You see a hunchback dressed in motley, sitting on the throne.\n*"Magpie is just keeping Alaric\'s chair warm - is all."',
    'You see a hunchback dressed in motley, parked on the throne like he owns the joint.\n*"Magpie\'s just keepin\' Alaric\'s seat warm, mate - no wuckas."', 1),
  T('Magpie standing', 0x1803,
    'You see a hunchback dressed in motley, with a pleasant demeanor.\n',
    'You see a hunchback dressed in motley, grinnin\' like a shot fox.\n', 1),   // the click mark after it is a jump target and stays
  T('Magpie, the master first', 0x1803,
    '"Please, talk to the master first."',
    '"Oi, have a yarn with the big fella first, ya galah."', 1),
  T('Omen’s first vision', 0x1801,
    'A strange-looking face suddenly fades into view before you...*"Poor little human - so far from home, and so far from the truth..."*"You do know, don\'t you, that Alaric is not all he says he is.  True, he is bound to the land, but as a usurper."*"He does not belong in the position of power, and he upsets the balance of the world by being there."*"And you, my friend, are just another puppet of his.  Now is the time of change, and you are at the pivot point."*"But which way will the balance swing?  To the East? Or to the West?"*"And myself?  I am Omen, and my master has instructed me to watch for one like you."*',
    'A strange-looking mug suddenly fades into view before ya...*"Poor little human - a long way from home, and even further from the truth, mate..."*"Ya do know, don\'tcha, that Alaric\'s not the full quid he makes out.  True, he\'s bound to the land, but as a bloody blow-in."*"He\'s got no business sittin\' in the big chair, and he\'s got the whole world arse-up just by bein\' there."*"And you, me old china, are just another one of his puppets.  It\'s crunch time, and you\'re smack bang at the pivot point."*"But which way\'s the balance gonna swing?  East?  Or west?"*"And me?  I\'m Omen, and me boss told me to keep a squiz out for one like you."*', 1),
  T('Omen’s second vision', 0x1801,
    '"At great price to myself I come to you, as a vision, to warn and guide you, protect and teach you."*"Know you this - there is more going on here than meets the eye, a power struggle as old as the world itself."*"And in this struggle, you are trapped.  If you ever expect to be free, heed my advice well."*"Alaric must be destroyed to restore the land, and in the end, you will do this."*"To aid you in your destiny, we have a small gift, to prove our word."*"But first, you must learn the ways of the land, and to this end my master has prepared a small test of your abilities."*"For you must hone your skills.  As a sword is tempered, so must you be."*"Seek your way out of this proving grounds, and along the way you might find your reward."*"Follow our counsel, and you will be well rewarded - ignore it at your own peril."*"Until we meet again, be on your guard, and trust not what your eyes behold."*',
    '"Cost me a bloody fortune to rock up like this, as a vision, to give ya the drum, keep ya out of strife and learn ya a thing or two."*"Get this into ya - there\'s more goin\' on here than meets the eye, a biffo as old as the world itself."*"And in this biffo, you\'re stuck like a shag on a rock.  If ya ever wanna be free, listen to me good, mate."*"Alaric\'s gotta be done in to fix the land, and in the end, that\'s your job."*"To give ya a leg-up with your destiny, we\'ve got a little prezzie, to show we\'re fair dinkum."*"But first ya gotta learn the lay of the land, so me boss has knocked up a little test of what you\'re made of."*"Ya gotta sharpen up.  Like a sword gets tempered, so do you, sunshine."*"Find ya way out of this proving ground, and along the way ya might find ya reward - bonza."*"Take our advice and you\'ll be sweet - ignore it and you\'re cactus."*"Till next time, keep ya wits about ya, and don\'t trust everything ya clap eyes on.  Hooroo."*', 1),
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
  if (!dataPath || !outDir) { console.error('usage: strine_opening_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
  const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Text Fixes (Strine Opening)',
    description: 'The text fixes, and the opening of the game -- the dream, Alaric, Magpie and Omen up to Omen’s Test -- in over-the-top Australian slang.',
    edits: [], dataEdits: [], textEdits: [...textFixEdits(), ...STRINE] });
  process.exit(ok ? 0 : 1);
}
