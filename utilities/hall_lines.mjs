/* The lines of the people of Land King Hall, as the text fixes leave them:
   what a cast of voices replaces. Each is one string of the game, matched
   whole, keyed by a short name a cast file uses to give its replacement
   (voices_patch.mjs, rickmorty_patch.mjs). A line's `count` is how many
   times the game holds it; a comment on a line says why it stops where it
   does (a click mark or closing quote after it is a jump target, and the
   cast's rename reaches a name in the tail). The order matters in two
   places, which the list keeps: "rick_thanks_to_you" comes after
   "rick_one_again", and "piemag_not_to_tell_three_times" after
   "piemag_glances_at_rick", so that a fragment is the only match left.
   Split out of voices_patch.mjs on 24 September 2026 for a second cast. */
import {buildPatch} from './patch_build.mjs';
import {T, textFixEdits} from './text_fixes_patch.mjs';

export const LINES = [
  { id: 'rick_description', resid: 0x1802, count: 1, find: `Before you stands an older, dignified gentleman` },
  { id: 'rick_desperate', resid: 0x1802, count: 1, find: `, but with a look of desperation.` },
  { id: 'rick_satisfied', resid: 0x1802, count: 1, find: `, with a look of satisfaction.` },
  { id: 'rick_relieved', resid: 0x1802, count: 1, find: `, with a look of relief and calm.` },
  { id: 'rick_the_dark_ending', resid: 0x1802, count: 1, find: `Just before your vision fades completely, the face of Alaric wavers.*` },
  { id: 'rick_possessed', resid: 0x1802, count: 1, find: `"Yes, thank you foolish mortal - without you, we never would have gained control of he who was once Alaric."*"With the powers of the Crolna, Land King Hall and all humanity behind us, we shall make short work of the Seldane."*"And then we can rid ourselves of the humans as well - our victory has been sealed."*` },
  { id: 'rick_piemag_vision', resid: 0x1802, count: 1, find: `Just before it fades completely, the vision Magpie appears before you.` },
  { id: 'rick_bahoudin_thanks', resid: 0x1802, count: 1, find: `*"Bahoudin thanks you for curing Alaric.  Were Alaric's mother, Chrysothemis, alive today, she would thank you."*"Alas, she is not.  Still, her husband, father of Alaric, Bahoudin, thanks you for saving his son."*` },
  { id: 'rick_first_speech', resid: 0x1802, count: 1, find: `"Ah - good, you are about.  We were worried that you were harmed."*"I suppose I should explain what happened.  My name is Alaric and you are now in the land of @Cythera."*"You were summoned in a final, desperate attempt to save Cythera and its ruler from chaos and madness."*"I am that ruler, and I have a special @bond with the land and the people of Cythera.  For over two hundred years I have used my magic to keep it prosperous."*"Unfortunately, over the past couple of years, my power has waned, and with it, Cythera has started slipping into chaos."*"It is as if that bond were dissolving, the land somehow changing. I do not understand it."*"The more impotent I become, the more frustrating it is to see it all slipping away, like waking from a dream..."*"I have trusted the fates to summon an outsider, from @Mater Theia herself, for only an outsider will be able to see through this cloud that blocks my vision."*"You, of course, are that outsider.  Do not think that I did this on a whim - it has cost me most of my remaining power to do so."*"I must trust you to help me.  I am sorry for the danger this costs you, but you are my, and Cythera's, last chance."` },
  { id: 'rick_rude_of_me', resid: 0x1802, count: 1, find: `"I am Alaric - did I tell you before?  I am sorry, how rude of me.\n"` },
  { id: 'rick_keeper', resid: 0x1802, count: 1, find: `"I am keeper of the land of Cythera,` },
  { id: 'rick_stranger', resid: 0x1802, count: 1, find: ` though at times I feel like a stranger."` },
  { id: 'rick_look_you_over', resid: 0x1802, count: 1, find: `"Hm, let's look you over..."*` },
  { id: 'rick_that_should_help', resid: 0x1802, count: 1, find: `"There, that should help..."` },
  { id: 'rick_good_shape', resid: 0x1802, count: 1, find: `"You look in pretty good shape as it is."` },
  { id: 'rick_stained', resid: 0x1802, count: 1, find: `"I'm sorry, but your soul is too stained for me to be able to cleanse it."` },
  { id: 'rick_register', resid: 0x1802, count: 1, find: `"Sorry, I can't help you until you registered this software."` },
  { id: 'rick_no_experience', resid: 0x1802, count: 1, find: `"You don't have enough experience for further training."` },
  { id: 'rick_amulet', resid: 0x1802, count: 1, find: `"Here, take this amulet - it has my symbol on it.  When worn around your neck, it will save your life if you die."*"You can also use it to bring back a companion from the halls of death, but be warned, it has a limited number of uses."*He gives you an amulet on a gold chain.*` },
  { id: 'rick_quarters', resid: 0x1802, count: 1, find: `*"I've got some quarters set up for you - Magpie will show you around."*` },
  { id: 'piemag_follow', resid: 0x1802, count: 1, find: `"Follow Magpie, you should."*` },
  { id: 'piemag_the_library', resid: 0x1802, count: 1, find: `Magpie points to the end of the hall to the north.*"At the end of the hall, the Library is."*"Much learning can be found in there, from the books written by elders.  Do you well it might to learn."*` },
  { id: 'piemag_the_quarters', resid: 0x1802, count: 1, find: `"These are quarters for you.  Provisions in there are."*"The things in your quarters are yours, serve you well they shall."*"But be careful not to steal from others.  Cythera is an honorable land, and such deeds will serve you ill."*Magpie looks around quickly.*"Magpie is the fool, but even Magpie knows your journey will be dangerous, young one."*"Good it would do you to learn what you can.  Important visitors come and go, but you are unique."*"Demodocus stays across the hall, for the nonce.  Talk with him, Magpie would, would that Magpie be you."*"Also, one might ask around to see if somebody would like to @join you on your quest..."` },
  { id: 'rick_help_me', resid: 0x1802, count: 1, find: `"Please, do what you can to help me."` },
  { id: 'rick_odemia', resid: 0x1802, count: 1, find: `"Odemia is the closest city - travel east, staying along the coast."` },
  { id: 'rick_the_land', resid: 0x1802, count: 1, find: `"Yes, Cythera is the land."` },
  { id: 'rick_one_again', resid: 0x1802, count: 1, find: `"I am as one with the land again, thanks to you."` },
  { id: 'rick_the_bond', resid: 0x1802, count: 1, find: `"I am, or was, at one with the land and its people.  I have provided all the basic needs of its people - a bountiful land, mild weather, and peace for its people."*"But now it all seems to be slipping away - a void where I can neither see nor affect."` },
  { id: 'rick_mater_theia', resid: 0x1802, count: 1, find: `"Mater Theia, Earthmother, at least before the @Journey brought us here.  Now we are without Mater Theia, but there are @stories."` },
  { id: 'rick_stories', resid: 0x1802, count: 1, find: `"Stories tell of a power, formed of Earth, which still walks the land, whom we call Metics."*"However, I doubt that they still live, or I should have been able to detect their presence."` },
  { id: 'rick_the_journey', resid: 0x1802, count: 1, find: `"We are not from this place, but from the same Earth that you are. We lived on an island called Thera, until Enesidaone reclaimed it."*"But that was not without warning, for a stranger, in the form of the Holy Bull appeared, telling us to flee.  We saw Thera destroyed from the safety of our ships at sea."*"That night a storm such as has never been before tossed us about, until in the morning when we woke up, tossed aside at the beach near what would become the city of Cademia."*"Or so goes the legend.  I am not a @historian - perhaps you should ask another..."` },
  { id: 'rick_history_forgotten', resid: 0x1802, count: 1, find: `"There are days I don't remember what happened the day before, much less more ancient history."*"For some reason, though, the number 201 seems important.  If you find out why, please tell me..."` },
  { id: 'rick_history_remembered', resid: 0x1802, count: 1, find: `"My history, I remember a few parts.  Living with my mother, as a child in Catamarca.  When she died, I left Catamarca, to roam."*"How I survived, I don't know.  I think I was seeking out the exiled Mages, for I felt I had powers beyond those of normals, and I would learn of them."*"Instead of finding them, I wandered into a cave, but it was not a cave. I crossed a bridge of stars, and found an abandoned hall or temple of some sort."*"Who built this place, I knew not.  It was empty and abandoned, but great power called to me."*"I remember standing on the edge of the Abyss, and felt myself surrender to it, becoming one with it, with the Land."*"It was then that I became the Land King.  I know not how long I stood there - for years, it was certain.  And in the end, I had completed the bond."*"I knew then that rule of the Tyrants must be ended.  And thus I ended it - and from that came the current system of Houses and Judges."*"All that seems to be failing now - perhaps my time has ended..."` },
  { id: 'rick_201', resid: 0x1802, count: 1, find: `"Yes, that is the day my mother passed away."` },
  { id: 'rick_201_unknown', resid: 0x1802, count: 1, find: `"That number seems important to me, but I don't know why."` },
  { id: 'rick_metics', resid: 0x1802, count: 1, find: `"Metics are those who lived in Cythera before we arrived.  Their ruins can be found outside Pnyx, and I hear more have been discovered in the Swamp of Khalkis"*"You should seek out a Freemage named Timon - he has studied them."` },
  { id: 'rick_enesidaone', resid: 0x1802, count: 1, find: `"Enesidaone, Mater Theia, the old gods.  They no longer guide our fate. Sadly, I'm the closest thing to a deity now..."` },
  { id: 'rick_chrysothemis', resid: 0x1802, count: 1, find: `"Chrysothemis was my mother - her I remember well."` },
  { id: 'rick_mother_remembered', resid: 0x1802, count: 1, find: `"Yes, she was my mother - I remember now.  It was in 201 that she passed away.  Yes, that was the start of it."*"I can remember parts of my @history again.  Who knows for how long, though..."*` },
  { id: 'rick_mother_missing', resid: 0x1802, count: 1, find: `"My mother, I remember, but not quite - a part of my memory is missing there..."` },
  { id: 'rick_mother_well', resid: 0x1802, count: 1, find: `"Chrysothemis was my mother - her I remember quite well now."` },
  { id: 'rick_father', resid: 0x1802, count: 1, find: `"Of my father, I remember nothing - perhaps I once did, but not now..."` },
  { id: 'rick_piemag', resid: 0x1802, count: 1, find: `"Magpie might be my fool, but he is a trusted advisor."` },
  { id: 'rick_excuse_me', resid: 0x1802, count: 1, find: `"Excuse me?"` },
  { id: 'rick_stares', resid: 0x1802, count: 1, find: `He just stares off into space.\n` },
  { id: 'rick_thanks_to_you', resid: 0x1802, count: 1, find: ` thanks to you."` },
  { id: 'rick_the_good_ending', resid: 0x1802, count: 1, find: `"You've done it!  It is remarkable - amazing.  I feel, I lack words for it."*"It is as if a fog has lifted, as if I have gained sight.  Every blade of grass, I sense."*"The land has suffered, but you have helped to cure it, and with it, me."*"I shall keep this artifact safe - its powers have re-tuned my senses."*"I don't know how to repay you for the service you've done, not only for myself, but the land as well."*"I shall return you to your own land, as I promised.  Thank you again."*Alaric waves his hands before you, and your vision grows dark...*` },
  { id: 'piemag_on_the_throne', resid: 0x1803, count: 1, find: `You see a hunchback dressed in motley, sitting on the throne.\n*"Magpie is just keeping Alaric's chair warm - is all."` },
  { id: 'piemag_standing', resid: 0x1803, count: 1, find: `You see a hunchback dressed in motley, with a pleasant demeanor.\n` },
  { id: 'piemag_master_first', resid: 0x1803, count: 1, find: `"Please, talk to the master first."` },
  { id: 'piemag_names', resid: 0x1803, count: 1, find: `"Many names Magpie has."` },
  { id: 'piemag_fool', resid: 0x1803, count: 1, find: `"Magpie is the King's Fool! Is that not enough?"` },
  { id: 'piemag_place', resid: 0x1803, count: 1, find: `"Sorry, but Magpie's place is with Alaric."` },
  { id: 'piemag_story_untold', resid: 0x1803, count: 1, find: `"A story that can not be told, it is."` },
  { id: 'piemag_history', resid: 0x1803, count: 1, find: `"History is everywhere, but nobody asks a rock its history."*"The history of Magpie, now there's a @story, but the history of Alaric, now that's a @tale."` },
  { id: 'piemag_the_tale', resid: 0x1803, count: 1, find: `"The tale of Alaric?  His story is history!"*Alaric laughs and capers as if he has told the best joke ever invented.*"Alaric it was that destroyed the rule of the Tyrants, and brought the Mages back from exile."*"He it was that set up government as it stands today.  But none know how he gained the power to do this feat."*"Or at least, none will say.  None is no one.  And no one is not one.  And not one is two."*Alaric again beams with delight.` },
  { id: 'piemag_more_stories', resid: 0x1803, count: 1, find: `"Perhaps we will share more stories..."` },
  { id: 'piemag_the_bond', resid: 0x1803, count: 1, find: `"A magical bond Alaric has with the land, which allows him to ensure its prosperity.  That is why he is called the Land King"*"And this place is thus Land King Hall, Hall of the Land King, Hall of Alaric."*"In truth, he is surely the King of more than just the Land."` },
  { id: 'piemag_not_welcomed', resid: 0x1803, count: 1, find: `"That is not a place where Magpie is welcomed."` },
  { id: 'piemag_welcomed', resid: 0x1803, count: 1, find: `"Magpie is welcomed there, or at least was."` },
  { id: 'piemag_wizards', resid: 0x1803, count: 1, find: `"City of Wizards.  They know how to treat Magpie."` },
  { id: 'piemag_metics', resid: 0x1803, count: 1, find: `"Metics are a legend, but so is Magpie, and both are true."*"Knows them, Magpie does.  Welcome by them, Magpie is not."` },
  { id: 'piemag_seldane', resid: 0x1803, count: 1, find: `"Seldane, Seldine, are they not all the same?  Metics by any other name."` },
  { id: 'piemag_a_son', resid: 0x1803, count: 1, find: `"A son Magpie has, and met him you have.  @Three that are one, he is.` },
  { id: 'piemag_no_more', resid: 0x1803, count: 1, find: `  More Magpie can not say.` },   // the closing quote after it is a jump target and stays
  { id: 'piemag_one', resid: 0x1803, count: 1, find: `"It is easy to say that one is, or is it?  Can one truly say what one is, and what one isn't?"*"Is one really one, or perhaps two?  Mayhaps even three?"` },
  { id: 'piemag_two', resid: 0x1803, count: 1, find: `"Two matters not, but three?"` },
  { id: 'piemag_four', resid: 0x1803, count: 1, find: `"Could there be four?  Why with man there can be five!"` },
  { id: 'piemag_five', resid: 0x1803, count: 1, find: `"If two of five are lost, there are then but three."` },
  { id: 'piemag_three', resid: 0x1803, count: 1, find: `"Jhiaxus is one.  Jinrai is one."*"Bahoudin is two.  Chrysothemis is one."*"Alaric is three."` },
  { id: 'piemag_not_ready', resid: 0x1803, count: 1, find: `"Ah, three, now that is important, but you are not ready for that knowledge."` },
  { id: 'piemag_mother', resid: 0x1803, count: 1, find: `"Mother of Alaric is that one."` },
  { id: 'piemag_the_name', resid: 0x1803, count: 1, find: `"You know the name - a dangerous tool it is, but a tool nonetheless."*"A tool to open, a tool to close."*"A tool to build, a tool to destroy."*"A tool to heal, a tool to poison."` },
  { id: 'piemag_sabinate', resid: 0x1803, count: 1, find: `*"Sabinate is right perhaps, but one can be wrong when one is right."*"Magpie fears it is last best hope for Alaric - great is the risk."` },
  { id: 'piemag_visions', resid: 0x1803, count: 1, find: `"Not all visions see deep to the truth of what is, and what must never be."` },
  { id: 'piemag_old_name', resid: 0x1803, count: 1, find: `"An old name, not used anymore."` },
  { id: 'piemag_motives', resid: 0x1803, count: 1, find: `"Many people have many motives, not all bode well."` },
  { id: 'piemag_jinrai', resid: 0x1803, count: 1, find: `"People of Jinrai are dangerous - very much so."` },
  { id: 'piemag_the_dead', resid: 0x1803, count: 1, find: `*"Remember well that the dead do not walk."` },
  { id: 'piemag_glances_at_rick', resid: 0x1803, count: 1, find: `He glances briefly at Alaric, as if to see if he is listening.*"That is a story that is not for Magpie to tell."` },
  { id: 'piemag_not_safe', resid: 0x1803, count: 1, find: `"Please - that name is not safe.  Magpie never uses that name."` },
  { id: 'piemag_bahoudin', resid: 0x1803, count: 1, find: `He glances around briefly.*"Magpie and Bahoudin, many stories.  That story is true."*` },
  { id: 'piemag_the_key', resid: 0x1803, count: 1, find: `"Yes, truth speaks Jhiaxus.  Magpie shall yield it to you, but there is great danger."*` },
  { id: 'piemag_fears', resid: 0x1803, count: 1, find: `"Great danger for all.  Magpie's fears come true..."*"You shall save us all..."*"...or destroy us all."*"You alone have the power to make the choice."*"Magpie sees better than Sabinate or Jhiaxus, but this is unseen."*"Sabinate and Jhiaxus have their own motives - remember this."*` },
  { id: 'piemag_not_to_tell_three_times', resid: 0x1803, count: 3, find: `"That is a story that is not for Magpie to tell."` },   // after the glance line took the fourth
  { id: 'piemag_the_king', resid: 0x1803, count: 1, find: `"The Kind is Alaric and Alaric is the King, @bonded to the @land."` },
  { id: 'piemag_land_and_water', resid: 0x1803, count: 1, find: `"Land and water, water and land - those two are not one, except for two, who are two and three."` },
  { id: 'piemag_ignae', resid: 0x1803, count: 1, find: `"Old Ignae is a trickster - the sly one he is."` },
  { id: 'piemag_tourguide', resid: 0x1803, count: 1, find: `"Tourguide Magpie has played for you once."` },
  { id: 'rambo_description', resid: 0x1804, count: 1, find: `You see an older warrior, with a proud demeanor.*` },
  { id: 'rambo_greeting', resid: 0x1804, count: 1, find: `"Greetings, and welcome to our world, stranger.  I am Hadrian, the Captain of Alaric's Guard, and @Trainer."` },
  { id: 'rambo_again', resid: 0x1804, count: 1, find: `"Greetings again, stranger` },
  { id: 'rambo_name', resid: 0x1804, count: 1, find: `"I am called Hadrian, the Captain of Alaric's Guards."` },
  { id: 'rambo_job', resid: 0x1804, count: 1, find: `"I am in charge of the guards that protect Alaric and Land King Hall."` },
  { id: 'rambo_proud', resid: 0x1804, count: 1, find: `"I am proud of the service that Hector has done for you."` },
  { id: 'rambo_served_with_honor', resid: 0x1804, count: 1, find: `"He has served you with honor, hasn't he!  I'm quite proud of him."*` },
  { id: 'rambo_hecky_blushes', resid: 0x1804, count: 1, find: `Hector blushes...*` },
  { id: 'rambo_how_is_my_son', resid: 0x1804, count: 1, find: `"How's my son doing?  Is he serving you with honor?"*` },
  { id: 'rambo_indeed', resid: 0x1804, count: 1, find: `"Indeed I am."` },
  { id: 'rambo_died', resid: 0x1804, count: 1, find: `"I regret to tell you that Hector has died in my service.  I am truly sorry."*` },
  { id: 'rambo_choked_up', resid: 0x1804, count: 1, find: `Hadrian seems choked up, and unable to speak for a moment.\n*"Thank you for telling me.  We all knew the risks involved."*"A warrior can know no better death than to die for a cause that is right and just."*` },
  { id: 'rambo_fine_son', resid: 0x1804, count: 1, find: `"Hector is a fine son, and will serve you with honor."` },
  { id: 'rambo_fine_lad', resid: 0x1804, count: 1, find: `"My son Hector is fine lad - he will be a great warrior and leader, once he has a bit more experience."` },
  { id: 'rambo_permission_given', resid: 0x1804, count: 1, find: `"Why, nothing would make me more proud!  He will serve you with honor!"*` },
  { id: 'rambo_train', resid: 0x1804, count: 1, find: `"I can @train you in that, if you'd like."` },
  { id: 'rambo_eioneus', resid: 0x1804, count: 1, find: `"I remember him - a bright young mage who was working on magically enhancing weapons."*"I haven't seen him for years now, I wonder how he's doing...  He might be worth tracking down."*` },
  { id: 'rambo_farewell_thanks', resid: 0x1804, count: 1, find: `"Farewell, and thank you."` },
  { id: 'rambo_farewell', resid: 0x1804, count: 1, find: `"Farewell."` },
  { id: 'rambo_a_favor', resid: 0x1804, count: 1, find: `*"Actually, if you don't mind, I was wondering if you could do a favor for me?"*"My mother passed away recently, but with my duties here, I don't have time to properly honor her."*"Could you place these flowers on her grave?  She is buried in the graveyard in Catamarca..."` },
  { id: 'rambo_andra', resid: 0x1804, count: 1, find: `"Thank you.  Her name was Andra, and she is buried next to my father Lycus"` },
  { id: 'rambo_declined', resid: 0x1804, count: 1, find: `"Well, I understand.  Thank you for considering it anyway."` },
  { id: 'rambo_mother', resid: 0x1804, count: 1, find: `"Andra was my mother."` },
  { id: 'rambo_father', resid: 0x1804, count: 1, find: `"Lycus was my father."` },
  { id: 'rambo_no_help', resid: 0x1804, count: 1, find: `"Can't help you on that."` },
  { id: 'emetic_description', resid: 0x1805, count: 1, find: `You see an older woman, a bit weary but happy.*` },
  { id: 'emetic_greeting', resid: 0x1805, count: 1, find: `"Greetings, and welcome to our world, stranger.  I am Emesa, Alaric's @cook."*"If there's @anything I can do for you to help you in your @journeys, please, just ask..."` },
  { id: 'emetic_again', resid: 0x1805, count: 1, find: `"Greetings again, stranger.` },
  { id: 'emetic_name', resid: 0x1805, count: 1, find: `"I am Emesa, ` },
  { id: 'emetic_cook', resid: 0x1805, count: 1, find: `"I am the @cook for @Alaric - my specialty is bread."` },
  { id: 'emetic_husband', resid: 0x1805, count: 1, find: `"Yes, my husband is Hadrian, the captain of the guards here..."*"A loving father, and a strong man, although a Alaric's ailing health has him troubled."*"You'll find him at the Land King's side most of the time these days...."` },
  { id: 'emetic_beloved', resid: 0x1805, count: 1, find: `"Yes, Hadrian is my beloved husband..."*"He works so hard to protect and care for Alaric in these times of strife, I @worry about him..."` },
  { id: 'emetic_worry', resid: 0x1805, count: 1, find: `"He rarely sleeps, and has become quite withdrawn of late..."*"I think his @concern for Alaric is overpowering the man I love; it's quite a burden for him to bear."*"You see, Hadrian's sworn duty is to protect Alaric, and Land King Hall, but now that an unseen force has afflicted his liege, he is left powerless to do anything about it."` },
  { id: 'emetic_concern', resid: 0x1805, count: 1, find: `"Hadrian's concern for Alaric has in turn led to my concern for my husband."*"He hasn't even had time to properly @mourn the passing of his mother, let alone tend to his family that still lives."` },
  { id: 'emetic_mourn', resid: 0x1805, count: 1, find: `"Hadrian's kindly mother passed away recently in Catamarca."*"She was such a kindly old woman, but one with much life left within her."*"A terrible shame to have it stolen from her."` },
  { id: 'emetic_concerned_for_rick', resid: 0x1805, count: 1, find: `"I too am concerned for Alaric..."*"I do what I can providing him with nourishing food to ease his weary bones and troubled brow."*"These are troubled times, stranger.  I do hope you can help him, and by doing so, help us, and all of the land of Cythera."` },
  { id: 'emetic_son', resid: 0x1805, count: 1, find: `"Hector is our son - we are very proud of him."` },
  { id: 'emetic_ask_rambo', resid: 0x1805, count: 1, find: `"You'll have to talk to Hadrian about that."` },
  { id: 'emetic_honor_to_cook', resid: 0x1805, count: 1, find: `"It is an honor to cook @food for Alaric."` },
  { id: 'emetic_piemag', resid: 0x1805, count: 1, find: `"Magpie is quite the jester, isn't he?"` },
  { id: 'emetic_journeys', resid: 0x1805, count: 1, find: `"Oh, I'd imagine you'll be traveling far and wide soon.  Be careful, keep your eyes open, and perhaps see if you can get some people to help you along the way."*"Nothing like having friends to help you out of a rough spot..."*"I don't travel much myself, so I don't know much about the goings on in the land, but my @husband is quite worldly."*"Perhaps he can tell you a thing or two?"` },
  { id: 'emetic_food', resid: 0x1805, count: 1, find: `"Well, I can offer you some @food if you like, but what we have around here won't keep you nourished for too long while off on travels..."*"Who knows how long it will be before you're able to find another place to @catch a meal?"*"You'll be able to get a something to eat at various @Inns, of course, but for a price."` },
  { id: 'emetic_animals', resid: 0x1805, count: 1, find: `"Animals roaming in the wilds of Cythera are a good source of meat, but be careful not to wantonly slaughter animals in town."*"They invariably belong to someone, and they'll be none too pleased with you."*"Please... if you do kill such wild animals for food, do so quickly and mericifully..."` },
  { id: 'emetic_inns', resid: 0x1805, count: 1, find: `"Oh, just about every village in Cythera has an Inn... a place where you can get a hot meal, and a good night's sleep."*"I don't condone many of the sort who hang about there for the drink, however..."*"And of course, you're always welcome to come back here instead, where I can give you something to eat before you turn in at your quarters for the night."` },
  { id: 'emetic_hungry', resid: 0x1805, count: 1, find: `"Are you hungry, and in need of food?"` },
  { id: 'emetic_gives_food', resid: 0x1805, count: 1, find: `"Let me get you something to eat."*She gives you some food\n` },
  { id: 'emetic_ask_when_hungry', resid: 0x1805, count: 1, find: `"Well, make sure to ask me if you are hungry."` },
  { id: 'emetic_refresher', resid: 0x1805, count: 1, find: `"Need a refresher?  I can understand - you've more important things on your mind."*` },
  { id: 'emetic_learn_bread', resid: 0x1805, count: 1, find: `"Would you like to learn how to make bread?"` },
  { id: 'emetic_other_time', resid: 0x1805, count: 1, find: `"Perhaps some other time."` },
  { id: 'emetic_recipe', resid: 0x1805, count: 1, find: `"Baking bread isn't that hard - Take some flour and spread it out."*"Take some water and add to the flour."*"Take a rolling pin and roll out the dough."*"Take the finished dough and bake it, and you're done!"` },
  { id: 'emetic_farewell', resid: 0x1805, count: 1, find: `"Farewell."` },
  { id: 'emetic_not_familiar', resid: 0x1805, count: 1, find: `"I'm sorry, but I'm not familiar with that."` },
  { id: 'hecky_weapon', resid: 0x1806, count: 1, find: `"It'll work as a weapon, but I've only been trained in edged weapons..."` },
  { id: 'hecky_description', resid: 0x1806, count: 1, find: `You see a young warrior, with a look of fire in his eyes.*` },
  { id: 'hecky_greeting', resid: 0x1806, count: 1, find: `"Ah, you are the one that was summoned by Alaric - my name is Hector, and I am honored to meet you!"` },
  { id: 'hecky_my_leader', resid: 0x1806, count: 1, find: `"Yes, my leader, what can I do for you?"` },
  { id: 'hecky_service', resid: 0x1806, count: 1, find: `, how can I be of service?"` },
  { id: 'hecky_earthquake', resid: 0x1806, count: 1, find: `"This is our training room, but with the damage done by that @earthquake, I don't know"` },
  { id: 'hecky_tremors', resid: 0x1806, count: 1, find: `"This area has always had minor tremors, but this is the first one that caused major damage."*"Come to think of it, there have been more tremors here since Alaric began to weaken."` },
  { id: 'hecky_name', resid: 0x1806, count: 1, find: `"I am called Hector - our legends tell of a great @warrior named Hector, and I hope to follow in his, and my @father's footsteps."*"So you're the @stranger that Alaric has summoned here to aid him?"` },
  { id: 'hecky_job', resid: 0x1806, count: 1, find: `"I am a warrior, or at least will be one, like my father."` },
  { id: 'hecky_father', resid: 0x1806, count: 1, find: `"My father Hadrian is the head of Alaric's guards - it is a very honorable profession"` },
  { id: 'hecky_stranger', resid: 0x1806, count: 1, find: `"Well, I hope Alaric knows what he's doing.  No offense, but you don't look like much of a hero to me..."*"However I suppose looks can be deceiving, as my @mother always says"` },
  { id: 'hecky_mother', resid: 0x1806, count: 1, find: `"My mother's right around the corner in the kitchen, usually."*"She's a kind-hearted soul, and it kills me to see her working at such a menial job."*"She's here mostly to be close to my @father, I think, and she does seem to enjoy her @work."` },
  { id: 'hecky_work', resid: 0x1806, count: 1, find: `"Well, she prepares all of the meals for folks in the Land King Hall, including @Alaric himself!"*"Say, I bet if you asked her, she'd be more than willing to cook you a hot meal..."` },
  { id: 'hecky_rick', resid: 0x1806, count: 1, find: `"Alaric is more than just our ruler, he binds the land together in some strange way that I don't understand."*"I may not know exactly what is going on, but I do know that as Alaric has weakened, the land has @suffered as well."` },
  { id: 'hecky_suffered', resid: 0x1806, count: 1, find: `"Much has happened in Cythera that would be unthinkable just a few scant years ago..."*"It's as if the land is stricken with a disease, and can no longer fight back against agents of @evil,"` },
  { id: 'hecky_criminals', resid: 0x1806, count: 1, find: `"I've heard stories of @criminals roaming rapant, and stranger still, of odd creatures roaming about."` },
  { id: 'hecky_cowards', resid: 0x1806, count: 1, find: `"How I'd love to give them a taste of their own medicine!  Dark-hearted cowards!"*"Cythera should return to the just land it once was..."` },
  { id: 'hecky_warrior', resid: 0x1806, count: 1, find: `"Yes, I hope to honor my @father, and as well as make a name for myself."*"I've been @training and studying the ways of a warrior."` },
  { id: 'hecky_training', resid: 0x1806, count: 1, find: `"My father helped me out with that; he's a great warrior in his own right, as well as a patient teacher."*"I think I've passed the point where training alone can help me, however..."` },
  { id: 'hecky_honor', resid: 0x1806, count: 1, find: `"Without honor, there is no meaning to life.  Most citizens of Cythera value honor highly, but myself more so than most."` },
  { id: 'hecky_already_following', resid: 0x1806, count: 1, find: `"But I'm already following you..."` },
  { id: 'hecky_ask_father', resid: 0x1806, count: 1, find: `"I would be honored, but I have my duty to my @father - you'll need to ask him first."` },
  { id: 'rambo_permission', resid: 0x1806, count: 1, find: `*"Don't be silly - it would honor me if you would allow my son to serve you in your quest!"*` },
  { id: 'hecky_thank_you_father', resid: 0x1806, count: 1, find: `"Thank you very much, Father.  I will do you proud."*` },
  { id: 'hecky_father_said_yes', resid: 0x1806, count: 1, find: `"My father said yes?  That is wonderful.  I am honored to join you on your most noble quest."` },
  { id: 'hecky_rejoin', resid: 0x1806, count: 1, find: `"It would be the highest honor to re-accompany you!"` },
  { id: 'hecky_served_poorly', resid: 0x1806, count: 1, find: `"Have I served you poorly?"` },
  { id: 'hecky_woe', resid: 0x1806, count: 1, find: `"Woe is me!  If you would give me another chance, I'll prove myself."` },
  { id: 'hecky_very_well', resid: 0x1806, count: 1, find: `"Very well, you have your own destiny to follow - please seek me out if you ever need a companion."` },
  { id: 'hecky_not_in_party_twice', resid: 0x1806, count: 2, find: `"I'm not currently in the party.  Perhaps I should @join you."` },
  { id: 'hecky_wait', resid: 0x1806, count: 1, find: `"I shall wait here until your return."` },
  { id: 'hecky_gladly', resid: 0x1806, count: 1, find: `"Gladly."` },
  { id: 'hecky_not_waiting', resid: 0x1806, count: 1, find: `"I'm not currently waiting to rejoin you.  Perhaps I should @join you."` },
  { id: 'hecky_anything_else', resid: 0x1806, count: 1, find: `"Let me know if there is anything else I can do for you..."` },
  { id: 'hecky_until_we_meet', resid: 0x1806, count: 1, find: `"Until we meet again..."` },
  { id: 'hecky_confused', resid: 0x1806, count: 1, find: `"You confuse me with your words."` },
  { id: 'bro_description', resid: 0x1807, count: 1, find: `You see a very serious-looking guard.*` },
  { id: 'bro_job', resid: 0x1807, count: 1, find: `"I guard Alaric here in Land King Hall."` },
  { id: 'bro_goodbye', resid: 0x1807, count: 1, find: `"Goodbye, stranger."` },
  { id: 'bro_not_permitted', resid: 0x1807, count: 1, find: `"I am just a guard, and not permitted to talk of such."` },
  { id: 'the_hero_dies', resid: 0x1801, count: 1, find: `You die, not knowing the fate of Alaric.` },
  { id: 'ollum_first_vision', resid: 0x1801, count: 1, find: `A strange-looking face suddenly fades into view before you...*"Poor little human - so far from home, and so far from the truth..."*"You do know, don't you, that Alaric is not all he says he is.  True, he is bound to the land, but as a usurper."*"He does not belong in the position of power, and he upsets the balance of the world by being there."*"And you, my friend, are just another puppet of his.  Now is the time of change, and you are at the pivot point."*"But which way will the balance swing?  To the East? Or to the West?"*"And myself?  I am Omen, and my master has instructed me to watch for one like you."*` },
  { id: 'ollum_second_vision', resid: 0x1801, count: 1, find: `"At great price to myself I come to you, as a vision, to warn and guide you, protect and teach you."*"Know you this - there is more going on here than meets the eye, a power struggle as old as the world itself."*"And in this struggle, you are trapped.  If you ever expect to be free, heed my advice well."*"Alaric must be destroyed to restore the land, and in the end, you will do this."*"To aid you in your destiny, we have a small gift, to prove our word."*"But first, you must learn the ways of the land, and to this end my master has prepared a small test of your abilities."*"For you must hone your skills.  As a sword is tempered, so must you be."*"Seek your way out of this proving grounds, and along the way you might find your reward."*"Follow our counsel, and you will be well rewarded - ignore it at your own peril."*"Until we meet again, be on your guard, and trust not what your eyes behold."*` },
  { id: 'ollum_first_piece', resid: 0x1801, count: 1, find: `The vision of Omen re-appears before you...*"Excellent!  You've found the first piece of the Crolna!"*"It will be most useful, trust me.  Seek out the rest of it..."*Just as suddenly, the vision fades.*` },
  { id: 'ollum_reform', resid: 0x1801, count: 1, find: `Again, Omen appears before your eyes...*"Ah, I see you have begun to reform the Crolna as a whole!  Excellent!"*"Now you are on to the heart of the mystery.  Once completed, the Crolna will be able to cure the land."*"Of course, you'll need the courage to wield it, but we have faith in you and your judgment."*"Beware your enemy, though, for they will ensnare you with lies hidden in half truths."*Omen fades away...*` },
  { id: 'ollum_destiny', resid: 0x1801, count: 1, find: `Omen appears in a vision again...*"You have done well, and we are proud of your accomplishments.  Now is the time for you to complete your destiny."*"You know what you need to do - do not fail us!"*Omen fades away...*` },
  { id: 'ollum_welcome', resid: 0x1801, count: 1, find: `The vision of Omen appears before you...*"Welcome to the wide world of Cythera!  A ready hero` },
  { id: 'ollum_unseen', resid: 0x1801, count: 1, find: `"Oh, by the way, don't worry, none of your fellow adventurers can see me."*"They don't even notice what's going on - they aren't quick enough to catch this instant."*` },
  { id: 'ollum_alone', resid: 0x1801, count: 1, find: `"Adventuring alone can be hazardous - perhaps you should have recruited somebody from Land King Hall."*` },
  { id: 'ollum_hecky', resid: 0x1801, count: 1, find: `"Perhaps that eager young Hector might want to come along.  Might be worth asking if his father lets him grow up."*` },
  { id: 'ollum_two_things_opening', resid: 0x1801, count: 1, find: `"Perhaps some eager young warrior living in Land King Hall might want to come along, if his father lets him grow up."*` },
  { id: 'ollum_two_things', resid: 0x1801, count: 1, find: `"There are basically two important things you need to investigate right away - a plague in Catamarca, and a kidnapping in Odemia."*"Either way, just follow the road down along the coast - Odemia is the first city you'll find, Catamarca the second."*"Good luck - and to start out, you might want to only travel during daytime, since some dangerous creatures come out at night."*"And whatever you do, stay away from the shoreline!"*` },   // "Omen fades away...*" after it is a jump target and stays; the rename reaches it
  { id: 'ollum_cademia', resid: 0x1801, count: 1, find: `The vision of Omen returns before you...*"Cademia.  Mother City.  Once you've lived in Cademia, no other place can be home."*"Keep your wits here - there are various miscreants that roam the back alleys, especially at night"*"Much lies buried beneath its ancient buildings - the city has much history that is now lost."*Omen fades away...*` },
  { id: 'ollum_danger', resid: 0x1801, count: 1, find: `The vision of Omen returns before you...*"Danger!  You are in great danger!"*"Beware what lies buried here - some things are best left undisturbed!"*"You must choose your own path, but what is here would destroy the world if unleashed!"*"And not even Alaric in his full powers would be able to stop this abomination!"*"It will tell you anything to get you to do its bidding - you must not even stoop to talk to it!"*"I beg you to leave well enough alone..."Omen fades away...*` },
  { id: 'ollum_abydos', resid: 0x1801, count: 1, find: `The vision of Omen returns before you...*"Lost Abydos - now just a reminder of a great failure..."*"None of the Mages dare admit it, but Abydos was destroyed by their leader."*"The Mage Tavara destroyed the city when the people rejected his leadership."*"If you enter the tunnels below the city, you'll even find his workroom - but be careful."*"That place is guarded by a fearsome magical being that you'd call a daemon."*"Don't say you weren't warned."Omen fades away...*` },
  { id: 'ollum_four_parts', resid: 0x1801, count: 1, find: `The vision of Omen returns before you...*"You are doing well - reforming the Crolna is most important to your success."*"But there are more parts to be found - a total of four."*"Getting the first two was the easy part - the next two will be a true test of your prowess."*Omen fades away...*` },
  { id: 'scroll_1', resid: 0x0219, count: 1, find: `Welcome, Human, to my little test for you.  It is not hard to pass, and will give you some of the skills you need to survive (though you may feel like a creature in a cage) - I hope that Omen did not startle you.  His appearance is strange, but don't let that deceive you. \n\nYou have already passed the first part of the test - you have read this note.  Next, you must pull that nearby lever to open the gate, leading you to the next room.  There you will find a locked trapdoor.  Find the key, open it, and then go down the ladder.` },
  { id: 'scroll_2', resid: 0x0219, count: 1, find: `Sorry, the key is not in this chest, but good try.  Look to your south - notice anything interesting about the wall?  Try using it...\n\nOh, you might want to use one of the torches in this chest, it will provide some light for you if you wield it in your hands...` },
  { id: 'scroll_3', resid: 0x0219, count: 1, find: `Ah, very good - very observant, finding that second secret door, but not all discoveries like this lead to reward, unfortunately.  However, this one does...` },
  { id: 'scroll_4', resid: 0x0219, count: 1, find: `This room is trickier - the door is locked by a spell.  You have but one chance to get this one open - take that strange-looking object, what you would call a bomb.  Pick it up, use it to light it, and then toss it so it lands right next to the door.  Stand back and let time pass...` },
  { id: 'scroll_5', resid: 0x0219, count: 1, find: `Not all levers are easily found - perhaps if you re-arranged things a bit here... (don't worry - all the crates are empty so it is easy for you to move them, and you don't need to waste your time searching them!)` },
];

/* A cast: display names, where "Omen" means the creature, the keywords the
   new names add, and the lines by id. castEdits turns it into the edits:
   the text fixes, the name table laid out afresh (its pointers carry the
   tag 0x9165, which the relinker does not follow), every line of the
   cast, the renames everywhere, and the keywords. The name table's function
   is built as source, with the names written into it, because a data edit
   is serialised into the sandbox and keeps no closure. */
const NUL = '\u0000';
export function castEdits({ names, omenResids, keywords, lines }) {
  const byId = new Map(LINES.map(l => [l.id, l]));
  const textEdits = [];
  const seen = new Set();
  for (const l of LINES) if (lines[l.id] !== undefined) { textEdits.push(T(l.id, l.resid, l.find, lines[l.id], l.count)); seen.add(l.id); }
  for (const id of Object.keys(lines)) if (!seen.has(id)) throw new Error('no line is called ' + id);
  for (const [a, b] of Object.entries(names)) if (a !== 'Omen' && a !== 'LKH Guard') textEdits.push({ ...T('mentions of ' + a, null, a, b) });
  if (names.Omen) for (const r of omenResids) textEdits.push({ ...T('mentions of Omen', r, 'Omen', names.Omen), optional: true });
  for (const [o, n] of keywords) {
    textEdits.push({ ...T('keyword ' + o + ' inside a list', null, o + ',', o + ',' + n + ',') });
    textEdits.push({ ...T('keyword ' + o + ' at the end of a list', null, o + NUL, o + ',' + n + NUL) });
  }
  const nameTable = { what: 'the name table', resid: 0x0201, fn: new Function('b', `
    const RENAME = ${JSON.stringify(names)};
    const n = ((b[0] << 8) | b[1]) & 0x0FFF;
    if (n !== 256 || (b[0] & 0xF0) !== 0x90) throw new Error('the name table is not an array of 256');
    const tags = [], out = [];
    for (let i = 0; i < n; i++) {
      const q = 2 + 4 * i, tag = (b[q] << 8) | b[q + 1], off = (b[q + 2] << 8) | b[q + 3];
      if (tag !== 0x9165) throw new Error('entry ' + i + ' has tag 0x' + tag.toString(16) + ', not 0x9165');
      let e = off; while (e < b.length && b[e] !== 0) e++;
      let s = ''; for (let k = off; k < e; k++) s += String.fromCharCode(b[k]);
      tags.push(tag); out.push(RENAME[s] !== undefined ? RENAME[s] : s);
    }
    for (const k of Object.keys(RENAME)) if (!out.includes(RENAME[k])) throw new Error('the name table has no ' + k);
    const head = [b[0], b[1]], ptrs = [], strs = []; let off = 2 + 4 * n;
    for (let i = 0; i < n; i++) { ptrs.push(off); for (const c of out[i]) strs.push(c.charCodeAt(0)); strs.push(0); off += out[i].length + 1; }
    for (let i = 0; i < n; i++) head.push((tags[i] >> 8) & 0xFF, tags[i] & 0xFF, (ptrs[i] >> 8) & 0xFF, ptrs[i] & 0xFF);
    return Uint8Array.from(head.concat(strs));`) };
  return { dataEdits: [nameTable], textEdits: [...textFixEdits(), ...textEdits] };
}
export function buildCast(cast, { htmlPath = 'index.html', dataPath, outDir }) {
  const { dataEdits, textEdits } = castEdits(cast);
  return buildPatch({ htmlPath, dataPath, outDir, name: cast.name, description: cast.description, edits: [], dataEdits, textEdits });
}
