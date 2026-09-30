/* delv-appfixes.js -- fixes to Cythera's application, as data.

   Every change this project makes to the program itself, one entry a
   change, in the form js/delv-apppatch.js applies and the Patches section
   and `utilities/app_patch.mjs` write out. This is the file to edit: add
   an entry, change a line, drop one, and the applier and its check
   (`utilities/app_patch_check.mjs`) do the rest. Nothing here is the
   program's bytes except the words each site expects to find, which is
   what makes a wrong application, or a wrong address, refuse rather than
   patch.

   WHICH PROGRAM. Cythera 1.0.4's PowerPC slice: the PEF container in the
   data fork, which SheepShaver, a real PowerPC Mac and the fork's PowerPC
   route run. The 68K slice, in the resource fork's CODE resources, is not
   touched, so a 68K Mac, and the fork and the player on their default
   route, run none of the code changes. The resource edits (the menu bar,
   the two STR# strings) are read by both slices. The workbench's
   `doc/executable-fixes.md` has the reading behind each entry.

   AN ENTRY.
     id, title   a name that does not change, and one line of what it does
     kind        'fix' (a bug), 'hook' (a call into Cythera Data's scripts,
                 below), 'text' (a misspelling), 'menu'
     bug         the entry's title in the workbench's bugs.md, where there
                 is one
     sites       [{ at, was: [words], asm: [lines] }]: a code address, the
                 words there now, and one line for each word that replaces
                 them
     cave        [lines]: new code, placed after the end of the code
                 section, which grows to hold it. `name:` on a line of its
                 own is a label; `@cave` in a site is the cave's first word
     data        [{ at, was, now }]: text in the data fork at a data-fork
                 offset; `now` no longer than `was`, the rest NUL
     rsrc        [{ type: 'STR#', id, index, was, now }]: `was` found once in
                 that string (numbered from 1) and replaced by `now`; or
                 [{ type, id, was: [bytes], now: [bytes] }] for a whole
                 resource

   A LINE is written as js/mac-ppc.js prints it (LLVM's spelling, registers
   as bare numbers), with `@0x...` for a code address, `@Name` for a
   routine by its mangled name and `@label` for a label in the entry's
   cave. `beq`, `bne` and the rest stand for the decoder's `bt` and `bf`.
   `;` begins a comment. js/mac-ppc-asm.js says what else it takes.

   HOOKS. A hook is a call from the program into the game's own scripts,
   so that what happens at that point can be changed by a Magpie patch to
   Cythera Data rather than by another change to the program. Each calls
   `TInterp::DoInterp` with a method number no class table uses (241 up;
   the keys 241 to 251 appear in none) on an object, the way the program
   already calls OnDeath (29) on a dying creature. The object's class
   answers if it defines the method, and failing that the default method
   script, resource 0x3000 plus the number (0x30F1 for 241), which the
   shipped Cythera Data does not have; with no script added the
   interpreter answers None and the program goes on as it did. A character
   is the object 0x4040nnnn (type 0x40, nnnn its character entry), a thing
   0x4000nnnn. None, True and False are the interpreter's own words, read
   from the globals `__sinit_THeap_cp` sets (0x5001FFFF, 0x50000001,
   0x50000000); a number is any word whose top four bits are 0.

   A CAVE IS FAR from the code it serves, more than the 32 KB a
   conditional branch reaches, so a site branches to it unconditionally
   and the test the site made moves into the cave, which leaves by `b`.
   The assembler refuses a branch that cannot reach.

   Each hook's cave makes a stack frame of its own for the call, 64 bytes
   with the answer at 56, so no slot of the routine it sits in is
   borrowed, and puts back every register the code after it reads. */

const APP_FIXES_TARGET = {
  name: 'Cythera 1.0.4, PowerPC',
  // The layout the applier grows. Another release, or a copy patched
  // already, differs here or at a site's words, and is refused.
  codeOffset: 0x3470, codeSize: 0xCD280, dataOffset: 0xD06F0,
};

const APP_FIXES = [
  // ---- In place ------------------------------------------------------------
  { id: 'option-p', kind: 'fix', title: 'Option-p prints the prop record and stops, without toggling regeneration',
    bug: 'option-p also toggles regeneration',
    sites: [{ at: 0x4448C, was: [0x60000000], asm: ['b @0x446B4            ; the exit the other cases take'] }] },

  { id: 'option-x', kind: 'fix', title: 'Option-x toggles swamp-poison protection on the player, not on character 0',
    bug: 'option-x does nothing',
    sites: [
      { at: 0x44030,
        was: [0x887D001A, 0x38000000, 0x54630630, 0x7C630050, 0x3003FFFF, 0x7C001910, 0x9801006F, 0x8801006F, 0x28000000, 0x41820018, 0x38600000],
        asm: ['lha 3, 0(30)          ; the player', 'slwi 3, 3, 5', 'add 3, 29, 3', 'lbz 3, 26(3)', 'andi. 3, 3, 128       ; flag 31',
              'beq @0x4406C          ; clear: AddAbility', 'nop', 'nop', 'nop', 'nop', 'lha 3, 0(30)          ; RemoveAbility, on the player'] },
      { at: 0x4406C, was: [0x38600000], asm: ['lha 3, 0(30)          ; AddAbility, on the player'] }] },

  { id: 'drag-northwest', kind: 'fix', title: 'A one-square drag to the north-west slides the thing, as the other seven directions do',
    bug: 'A one-square drag to the north-west does nothing',
    sites: [{ at: 0x28838, was: [0x41820064], asm: ['beq @0x28858          ; cursor 22 slides too'] }] },

  { id: 'theft-moved', kind: 'fix', title: 'A thing moved on the ground stays somebody’s, and a thing the hero drops is free to take back',
    bug: 'Moving an item before taking it avoids the theft check',
    sites: [
      { at: 0x54FFC, was: [0x540007FF], asm: ['andi. 0, 0, 17        ; free if it was free, or carried'] },
      { at: 0x54258, was: [0x28000000, 0x41820010, 0x881E0000, 0x28000008, 0x40820094],
        asm: ['andi. 0, 0, 223       ; the moved bit aside', 'beq @0x5426C', 'cmplwi 0, 8', 'bne @0x542FC', 'nop'] }] },

  { id: 'weight-contents', kind: 'fix', title: 'GetWeight counts the item type’s own weight only, not also the load of whatever thing has the same number as the type',
    bug: 'The scale gives wrong weights',
    sites: [{ at: 0x958A4, was: [0x4BFC01B5], asm: ['li 3, 0               ; was bl GetCurInvEncumb'] }] },

  { id: 'books-window', kind: 'fix', title: 'RemoveItem redraws the window of whatever held the thing it took',
    bug: 'Sapphire Books in a container can be handed in again and again',
    sites: [{ at: 0x95344,
      was: [0x7FE3FB78, 0x4BFC0435, 0x60000000, 0x7C630734, 0x7FC00734, 0x7C001800, 0x41800028, 0x7FE3FB78, 0x4BFC0419, 0x60000000, 0x38030000, 0x387D0000,
            0x7FC0F050, 0x4BF72615, 0x60000000, 0x48000024, 0x7FE3FB78, 0x4BFC03F5, 0x60000000, 0x7C9E1850, 0x387F0000, 0x4BFC0275, 0x60000000, 0x3BC00000],
      asm: ['mr 3, 29', 'bl @GetPropParent__Fs', 'sth 3, 56(1)          ; the holder, in a free word of the frame',
            'mr 3, 31', 'bl @GetItemCount__FP8PropItem', 'extsh 28, 3',
            'cmpw 30, 28', 'blt @0x95374',
            'sub 30, 30, 28', 'mr 3, 29', 'bl @DeleteProp__Fs', 'b @0x95384',
            'sub 4, 28, 30', 'mr 3, 31', 'bl @SetItemCount__FP8PropItems', 'li 30, 0',
            'lha 3, 56(1)', 'li 4, 2', 'bl @Invalidate__16TInventoryWindowFss', 'b @0x953A4',
            'nop', 'nop', 'nop', 'nop'] }] },

  // In cbsetpropowner, TakeItem's handler. It moves the thing whose top
  // holder is the giver (r27) to the receiver (r29) and redraws those two
  // windows, not the container the thing sat in, so an open chest kept
  // drawing a ring handed to Thersites. The holder it leaves is the low
  // halfword of the record's first word, as GetPropParent reads it for
  // every contained state; it is read before the record is rewritten and
  // its window marked first, which is only an invalidation, so the order
  // does not matter. The nop after each call goes (the calls are local, so
  // nothing is restored there) and the reload of the first word is the
  // register already holding it, which makes room for the one call more.
  { id: 'take-window', kind: 'fix', title: 'TakeItem redraws the window of whatever held the thing it moved',
    bug: 'A ring handed to Thersites still drawn in an open chest',
    sites: [{ at: 0x94B0C,
      was: [0x80DF0000, 0x7FA40734, 0x807F0000, 0x38000010, 0x54C5021E, 0x7CA42378, 0x5083023E, 0x907F0000, 0x7F63DB78, 0x38800002, 0x981F0000,
            0x4BF9CFF5, 0x60000000, 0x387D0000, 0x38800002, 0x4BF9CFE5, 0x60000000],
      asm: ['lha 3, 2(31)          ; the holder it leaves: a container, or the giver',
            'li 4, 2', 'bl @Invalidate__16TInventoryWindowFss',
            'lwz 6, 0(31)', 'extsh 4, 29', 'li 0, 16', 'rlwinm 5, 6, 0, 8, 15', 'or 4, 5, 4', 'rlwimi 6, 4, 0, 8, 31', 'stw 6, 0(31)', 'stb 0, 0(31)',
            'mr 3, 27              ; the giver, as before', 'li 4, 2', 'bl @Invalidate__16TInventoryWindowFss',
            'addi 3, 29, 0         ; the receiver, as before', 'li 4, 2', 'bl @Invalidate__16TInventoryWindowFss'] }] },

  // In TActiveMonster::DoMove, behaviour 113, which the destructor gives to
  // every character whose combat target has gone. All three branches (a
  // party member back to following, anyone else to their post or their
  // schedule) end in one tail that sets nutrition to 30 and the timing
  // byte to 32, so a companion was fed whenever its target died or the
  // party left an area mid-fight, and one fed past 30 was cut back. The
  // tail's two middle words swap places, so the timing store has an entry
  // of its own, and the party member's branch takes it; the others, and
  // behaviour 146, which enters the tail at its start, are as before.
  { id: 'target-hunger', kind: 'fix', title: 'A companion whose target is gone goes back to following without its hunger set to 30',
    bug: 'Followers\' hunger and poison clear on their own',
    sites: [
      { at: 0x4C464, was: [0x48000058], asm: ['b @0x4C4C8            ; a party member: past the nutrition'] },
      { at: 0x4C4C4, was: [0x38800020, 0x98A6001B], asm: ['stb 5, 27(6)          ; nutrition 30, for the others', 'li 4, 32              ; the party member joins here'] }] },

  // In TCharacterWindow::MouseRoutine. A click below v 272 is on the tab
  // strip, and the pane chosen is h / 73 (the multiply by 0xE070381D and
  // shift by 6 before 0x2F17C), with no test: the window (WIND 132) is 220
  // wide, so h 0 to 218 give the three panes, 0 to 2, and the last column,
  // h 219, gives 3. ChangePane hides every pane's controls, draws nothing
  // for 3, and DrawTabsPart draws no tab for it, so the window goes blank
  // until another tab is clicked: Two Jacks's one pixel at "the upper right
  // (triangle thing) of the bottom right", the Strategy tab's slanted end.
  // The pane is held to 2 now, the tab drawn under that column. The words
  // replaced are the rounding of the division for a negative h, which a
  // click in the window cannot give, and a copy through 152(1), read
  // nowhere else.
  { id: 'tab-pane', kind: 'fix', title: 'A click on the last pixel of a character window’s tabs opens the right-hand tab, instead of blanking the window',
    bug: 'Clicking one pixel blanks the status window',
    sites: [{ at: 0x2F17C, was: [0x54030FFE, 0x7C001A14, 0x7C000734, 0xB0010098, 0x7FE3FB78, 0xA8810098],
      asm: ['mr 4, 0               ; the pane, h / 73', 'cmpwi 4, 2', 'ble @0x2F18C', 'li 4, 2               ; h 219, past the third', 'mr 3, 31', 'nop'] }] },

  { id: 'sleep-hidden', kind: 'fix', title: 'A character who has not yet been drawn, and is moved to a post on the party’s level while time passes quickly, waits there as an egg instead of being hidden',
    bug: 'NPCs vanish while the player sleeps',
    sites: [{ at: 0x65F8, was: [0x281C0000, 0x41820018, 0x7F83E378, 0x819C0048, 0x818C0014, 0x480BEADD, 0x80410014, 0x380000FF, 0x981E0000],
      asm: ['li 0, 255', 'clrlwi. 3, 24, 24     ; the post on the party’s level?', 'beq @0x6608', 'li 0, 66', 'stb 0, 0(30)', 'b @0x661C', 'nop', 'nop', 'nop'] }] },

  { id: 'gamepad-keys', kind: 'fix', title: 'A gamepad’s Use, Attack, Look and Talk send their own keys',
    sites: [
      { at: 0xACB70, was: [0x3800004C], asm: ['li 0, 85              ; Use: U'] },
      { at: 0xACBA0, was: [0x38000055], asm: ['li 0, 65              ; Attack: A'] },
      { at: 0xACBD0, was: [0x38000054], asm: ['li 0, 76              ; Look: L'] },
      { at: 0xACC00, was: [0x38000041], asm: ['li 0, 84              ; Talk: T'] }] },

  // ---- New code ---------------------------------------------------------------
  { id: 'containers-weight', kind: 'fix', title: 'A thing put in a container someone carries is weighed against the one who carries it too',
    bug: 'Containers let you carry any weight',
    sites: [{ at: 0x5423C, was: [0x40810018], asm: ['b @cave               ; was ble 0x54254'] }],
    cave: [
      'bgt @fail              ; over the container’s own limit',
      'lha 3, 180(1)', 'subf 0, 3, 0          ; the thing and what it holds', 'sth 0, 184(1)',
      'mr 3, 28              ; the destination', 'bl @GetPropUltimateParent__Fs', 'extsh. 3, 3', 'beq @ok                ; a character, or held by nobody',
      'cmpwi 3, 256', 'bge @ok                ; held by a thing', 'sth 3, 186(1)',
      'mr 3, 29              ; the thing', 'bl @GetPropUltimateParent__Fs', 'extsh 3, 3', 'lha 4, 186(1)', 'cmpw 3, 4', 'beq @ok                ; already theirs',
      'lha 3, 186(1)', 'bl @GetCurInvEncumb__Fs', 'extsh 3, 3', 'lha 0, 184(1)', 'add 0, 0, 3', 'sth 0, 184(1)',
      'lha 3, 186(1)', 'bl @GetMaxInvEncumb__Fs', 'extsh 3, 3', 'lha 0, 184(1)', 'cmpw 0, 3', 'bgt @fail',
      'ok:', 'b @0x54254', 'fail:', 'b @0x54240             ; the refusal already there'] },

  // In TActiveMonster::~TActiveMonster. A creature that leaves a corpse has
  // its number set to 0 by Die, so that the destructor keeps its record as
  // the corpse, and the destructor then called RemoveAllAbility with that
  // 0, which removes every timed effect filed under character 0: the light
  // spells file theirs there, so killing such a creature put the party's
  // light out. Character 0 is nobody, so nothing of a creature's own is
  // filed under it; the call is skipped for 0 and made as before otherwise.
  { id: 'corpse-light', kind: 'fix', title: 'Killing a creature that leaves a corpse no longer ends Embrightenment or Daylight',
    bug: 'Killing certain creatures ends Embrightenment and Daylight',
    sites: [{ at: 0x464EC, was: [0xA87D0008], asm: ['b @cave               ; was lha 3, 8(29)'] }],
    cave: ['lha 3, 8(29)', 'cmpwi 3, 0', 'beq @skip              ; a corpse’s creature: nothing of its own under 0',
           'bl @RemoveAllAbility__8TSpellFXFs', 'skip:', 'b @0x464F8'] },

  // TGameSys::WalkToLocation was shipped empty (li 3, 0; blr). Its six
  // callers are TDroppableWindow::MouseRoutine's: a Look, Attack, Use or
  // Talk clicked on something out of reach asks it to bring the current
  // character there and acts only if it answers true, and a click on the
  // ground far off calls it and ignores the answer. So a touch spell aimed
  // at someone not beside the caster, and every command clicked on
  // something distant, did nothing. It takes one step now and answers
  // false, the game's one click, one turn: each click brings the character
  // a square nearer, and once in reach the command acts as it always did.
  // The step is the one the click's own path finding would take:
  // TPathFinder::FindPath from the character at TOC -30356 (whom
  // MoveCommand moves) with no monster, as MouseRoutine calls it, then
  // FindFirstStep for the first square, turned into MoveCommand's direction
  // through the table MouseRoutine turns a click's offset into a cursor
  // with (TOC -3258, five by five, index (dy + 2) * 5 + dx + 2: the ring
  // about the centre is the directions 0 to 7, north clockwise, the centre
  // 9). FindPath answers 32767 when the target is more than 15 squares off
  // or nothing nearer was found, and FindFirstStep would then walk a grid
  // nobody filled, so that answer takes no step.
  { id: 'walk-to', kind: 'fix', title: 'A command or touch spell clicked on something out of reach takes a step towards it, instead of doing nothing',
    bug: 'Touch spells only work on someone next to you',
    sites: [{ at: 0x50E5C, was: [0x38600000], asm: ['b @cave               ; was li 3, 0 (and blr)'] }],
    cave: ['mflr 0', 'stw 0, 8(1)', 'stwu 1, -80(1)', 'stw 31, 76(1)', 'mr 31, 3              ; the game',
           'mr 7, 4', 'mr 8, 5                ; where to',
           'lwz 3, -30356(2)', 'lha 3, 0(3)           ; the character in control', 'slwi 3, 3, 4',
           'lwz 6, -30268(2)', 'lwz 6, 0(6)', 'add 6, 6, 3           ; its map record',
           'lwz 5, 0(6)', 'rlwinm 5, 5, 8, 0, 12', 'srawi 5, 5, 20        ; x',
           'lha 6, 2(6)', 'rlwinm 6, 6, 20, 0, 12', 'srawi 6, 6, 20        ; y',
           'li 4, 0', 'lwz 3, -30412(2)      ; the path finder',
           'bl @FindPath__11TPathFinderFP14TActiveMonsterssss',
           'extsh 3, 3', 'cmpwi 3, 32767', 'beq @none',
           'lwz 3, -30412(2)', 'addi 4, 1, 56', 'addi 5, 1, 58', 'bl @FindFirstStep__11TPathFinderFRsRs',
           'lha 4, 56(1)', 'lha 5, 58(1)', 'addi 5, 5, 2', 'mulli 5, 5, 5', 'add 4, 4, 5', 'addi 4, 4, 2', 'slwi 4, 4, 1',
           'addi 3, 2, -3258', 'lhax 4, 3, 4          ; the direction', 'cmpwi 4, 7', 'bgt @none',
           'mr 3, 31', 'bl @MoveCommand__8TGameSysFQ28TGameSys10EDirection',
           'none:', 'li 3, 0', 'lwz 31, 76(1)', 'addi 1, 1, 80', 'lwz 0, 8(1)', 'mtlr 0', 'blr'] },

  // TJournalList::AppendEntry adds one List Manager row a wrapped line and
  // sets 12 bytes of cell data in it, and the List Manager keeps its cell
  // data at 16-bit offsets: "The List Manager cannot maintain lists that
  // occupy more than 32 KB of memory" (More Macintosh Toolbox, page 405 of
  // the PDF), so past about 2,730 rows LSetCell fails and the new lines draw
  // as blank rows, 453's "lots of big empty spaces". Both of AppendEntry's
  // LAddRow calls go through a cave now that, with 2,688 rows or more, first
  // deletes the list's top row, the oldest line, and moves the row about to
  // be added, and the caller's copy of it at 92(1) (156 from the cave's
  // frame), up by one. The journal file keeps every entry; only the window
  // shows the newest 2,688 lines. The call replaced was a glue call, after
  // which AppendEntry reloads its TOC from 20(1); for the first LAddRow
  // nothing has stored it there yet, so the cave does, as a glue stub would.
  // Packing a row into fewer bytes was the other design, and only moves the
  // limit.
  { id: 'journal-rows', kind: 'fix', title: 'A long journal keeps its newest lines readable, dropping the oldest from the window, instead of drawing new ones blank',
    bug: 'The journal breaks when it gets too long',
    sites: [
      { at: 0x78684, was: [0x4804A4B5], asm: ['bl @cave              ; was bl LAddRow, the entry’s header'] },
      { at: 0x78784, was: [0x4804A3B5], asm: ['bl @cave              ; was bl LAddRow, a line of its text'] }],
    cave: ['stw 2, 20(1)          ; where the caller reloads its TOC from', 'mflr 0', 'stw 0, 8(1)', 'stwu 1, -64(1)',
           'stw 3, 40(1)', 'stw 4, 44(1)', 'stw 5, 48(1)',
           'lwz 6, 0(5)', 'lha 6, 76(6)          ; the rows, dataBounds.bottom', 'cmpwi 6, 2688', 'blt @add',
           'li 3, 1', 'li 4, 0', 'bl @0xC2B20            ; LDelRow(1, 0, list): the oldest line', 'lwz 2, 20(1)',
           'lwz 4, 44(1)', 'addi 4, 4, -1', 'stw 4, 44(1)',
           'lha 7, 156(1)         ; the caller’s row', 'addi 7, 7, -1', 'sth 7, 156(1)',
           'add:', 'lwz 3, 40(1)', 'lwz 4, 44(1)', 'lwz 5, 48(1)', 'bl @0xC2B38            ; LAddRow', 'lwz 2, 20(1)',
           'addi 1, 1, 64', 'lwz 0, 8(1)', 'mtlr 0', 'blr'] },

  // Both TActiveMonster constructors store ObjToMonst's answer as the new
  // creature's unit (4 of the object) and nothing checks it; for a prop
  // type with no entry in 0xF008 the answer is null, and the creature's
  // stats, flags, alignment and, at its death, its corpse word are then
  // read from low memory. The scenario gives the two types that happened
  // units ("Cythera Community Fixes", sleeping-units); this is the
  // program's own guard, for a scenario without that fix or a type added
  // later: a null unit is the table's first record (TOC -30376, the base
  // ObjToMonst walks), the hero's. ObjToMonst itself still answers null,
  // since HatchEgg and the scripts' Ctor read that as "no unit".
  { id: 'unit-guard', kind: 'fix', title: 'A creature whose type has no unit is given the first unit, instead of reading its stats and corpse from nowhere',
    bug: 'NPCs killed in one hit or asleep turn into other objects',
    sites: [
      { at: 0x44C08, was: [0x907E0004], asm: ['b @made               ; was stw 3, 4(30)'] },
      { at: 0x46094, was: [0x907C0004], asm: ['b @loaded             ; was stw 3, 4(28)'] }],
    cave: ['made:', 'cmplwi 3, 0', 'bne @made1', 'lwz 3, -30376(2)', 'lwz 3, 0(3)            ; the first unit',
           'made1:', 'stw 3, 4(30)', 'b @0x44C0C',
           'loaded:', 'cmplwi 3, 0', 'bne @loaded1', 'lwz 3, -30376(2)', 'lwz 3, 0(3)',
           'loaded1:', 'stw 3, 4(28)', 'b @0x46098'] },

  // cbPickItem, the syscall behind ShowMenu (the "Where Is" lists, and every
  // menu a script shows), fills one static array of twenty 12-byte item
  // drawers, whose address is the TOC slot at -25704, built once through
  // the runtime's array constructor (0xBE3E4, with 12 and 20) behind the
  // guard byte at TOC -25700, and it stops at the twentieth item
  // (cmpwi 0, 20 at 0x96924): Pnyx's list holds 31. The menu itself
  // (TPickMode) draws from the vector it is handed until its box is full
  // and scrolls, with no count of its own. Now the first call allocates
  // 64 drawers (operator new, 0xBE7C8, as the routine's own vector does),
  // puts the address in the TOC slot, where every later call reads it, and
  // in r24, and builds them; the guard byte keeps the capacity (it only had
  // to be nonzero) and the loop's test reads it. If the allocation fails the
  // shipped array is built with its 20, as before. r25 is free until
  // 0x96AAC sets it.
  { id: 'menu-items', kind: 'fix', title: 'A menu offered by a script, a "Where Is" list above all, shows up to 64 entries instead of stopping at 20',
    bug: '"Where Is" lists are cut short',
    sites: [
      { at: 0x968A4, was: [0x80828D9C], asm: ['b @init               ; was lwz 4, -29284(2)'] },
      { at: 0x96924, was: [0x2C000014], asm: ['b @cap                ; was cmpwi 0, 20'] }],
    cave: ['init:', 'li 3, 768              ; 64 drawers of 12 bytes', 'bl @0xBE7C8', 'li 25, 20', 'cmplwi 3, 0', 'beq @build              ; no memory: the shipped array',
           'mr 24, 3', 'stw 3, -25704(2)      ; where every later call finds it', 'li 25, 64',
           'build:', 'lwz 4, -29284(2)', 'mr 3, 24', 'li 5, 0', 'li 6, 12', 'mr 7, 25', 'bl @0xBE3E4',
           'lwz 3, -25700(2)', 'stb 25, 0(3)          ; built, and how many', 'b @0x968CC',
           'cap:', 'lwz 3, -25700(2)', 'lbz 3, 0(3)', 'cmpw 0, 3', 'b @0x96928'] },

  { id: 'widget-renumber', kind: 'fix', title: 'A scripted window’s buttons follow their owner to its new number on a zone change',
    bug: 'The strange device has to be reopened after changing zones',
    sites: [{ at: 0x87B94, was: [0x4E800020], asm: ['b @cave               ; was a bare blr'] }],
    cave: ['lwz 6, 4(3)           ; the owner copy', 'clrlwi 7, 6, 16', 'cmpw 7, 4             ; the old number', 'bnelr',
           'rlwimi 6, 5, 0, 16, 31 ; the new one', 'stw 6, 4(3)', 'blr'] },

  { id: 'music-revert', kind: 'fix', title: 'The music comes back after a revert, an Open or a Save As',
    bug: 'Music stops after a revert, and MIDI gets corrupted in long play',
    sites: [
      { at: 0x1AB84, was: [0x38000001], asm: ['b @keep               ; was li 0, 1'] },
      { at: 0x1ABA4, was: [0x41820094], asm: ['b @same               ; was beq 0x1AC38'] }],
    cave: ['keep:', 'lbz 26, 0(3)          ; playing before this call?', 'li 0, 1', 'b @0x1AB88',
           'same:', 'bne @make              ; another tune: as before', 'cmpwi 26, 0', 'beq @make              ; stopped: make it again and play',
           'b @0x1AC38            ; the same tune, playing: as before', 'make:', 'b @0x1ABA8'] },

  { id: 'hero-square', kind: 'fix', title: 'The hero keeps its square in the creature grid, so a follower on it no longer hides the hero from a drag',
    bug: 'The player cannot be dragged onto a follower\'s square',
    sites: [
      { at: 0x6B14C, was: [0x40820008], asm: ['b @one                ; was bne 0x6B154'] },
      { at: 0x6B020, was: [0x40820010], asm: ['b @four               ; was bne 0x6B030'] }],
    cave: ['one:', 'beq @take1             ; empty: as before', 'lwz 5, -30356(2)      ; the player', 'lha 5, 0(5)', 'cmpw 4, 5', 'bne @done1',
           'take1:', 'sth 4, 0(23)', 'done1:', 'b @0x6B154',
           'four:', 'beq @take4', 'lwz 5, -30356(2)', 'lha 5, 0(5)', 'cmpw 4, 5', 'bne @done4',
           'take4:', 'extsh 0, 31', 'slwi 0, 0, 1', 'sthx 4, 30, 0', 'done4:', 'b @0x6B030'] },

  { id: 'spell-glow', kind: 'fix', title: 'A creature’s spell glow is drawn on the creature, not on the thing its entry’s number names',
    bug: 'A lich\'s spell glow and lightning come out of a chair',
    sites: [{ at: 0x99750, was: [0x7C640734], asm: ['b @cave               ; was extsh 4, 3'] }],
    cave: ['extsh 4, 3', 'rlwinm 3, 3, 16, 24, 31 ; the reference\'s type', 'cmpwi 3, 64', 'bne @as', 'cmpwi 4, 256', 'bge @creature',
           'as:', 'b @0x99754            ; a thing, or a character: its number is its record',
           'creature:', 'stw 0, 56(1)', 'stw 4, 60(1)', 'lwz 3, -30352(2)      ; the character table', 'slwi 4, 4, 5', 'add 3, 3, 4',
           'bl @GetCharacter__14TActiveMonsterFP9CharEntry', 'lwz 4, 60(1)', 'cmplwi 3, 0', 'beq @back',
           'lwz 4, 16(3)          ; its map record', 'lwz 5, -30268(2)', 'lwz 5, 0(5)           ; the prop table', 'sub 4, 4, 5', 'srawi 4, 4, 4',
           'back:', 'lwz 0, 56(1)', 'lwz 5, -30408(2)', 'li 6, 1', 'b @0x99754'] },

  // In TConversation::ShowPortrait. The name is in the frame at 56(1); r28 is
  // the portrait's GWorld, the current port, whose txSize is the halfword at
  // 74; r23 is dead once the routine has set its port, and keeps the size to
  // put back. The imports are called at their glue: TextWidth 0xC2AC0,
  // TextSize 0xC35B8, CharExtra 0xC3630; 0xB6CE8 is strlen.
  { id: 'name-fit', kind: 'fix', title: 'A long name under a conversation portrait is drawn smaller until it fits, not squeezed until its letters overlap',
    bug: 'A long name under a conversation portrait is squeezed until its letters overlap',
    sites: [
      { at: 0x3DE90, was: [0x38800054, 0x4BFFDAA1], asm: ['b @fit                ; was li 4, 84', 'nop                   ; was bl FitText'] },
      { at: 0x3DF68, was: [0x38600000, 0x480856C5, 0x80410014], asm: ['b @restore            ; was li 3, 0', 'nop                   ; was bl CharExtra', 'nop                   ; was lwz 2, 20(1)'] }],
    cave: ['fit:', 'lha 23, 74(28)        ; the size, to put back after',
           'measure:', 'addi 3, 1, 56', 'bl @0xB6CE8', 'mr 5, 3', 'addi 3, 1, 56', 'li 4, 0', 'bl @0xC2AC0', 'lwz 2, 20(1)',
           'extsh 3, 3', 'cmpwi 3, 104', 'ble @fits              ; clear of the other speaker\'s text',
           'lha 3, 74(28)', 'cmpwi 3, 9', 'ble @squeeze', 'addi 3, 3, -1', 'bl @0xC35B8', 'lwz 2, 20(1)', 'b @measure',
           'squeeze:', 'addi 3, 1, 56', 'li 4, 104', 'bl @FitText__FPCcs   ; at 9 points and still too wide: the shipped squeeze',
           'fits:', 'b @0x3DE98',
           'restore:', 'li 3, 0', 'bl @0xC3630', 'lwz 2, 20(1)', 'mr 3, 23', 'bl @0xC35B8', 'lwz 2, 20(1)', 'b @0x3DF74'] },

  // In TConversation::ShowTalking. The speech is cleared by copying the
  // background over one rectangle, SetRect(103, 12, 488, 276) offset 12
  // across, and the same rectangle, copied to 2136(31) with its bottom set
  // to 80, is the box the text is laid out in from its left edge at 115.
  // Argos's P, R, j, Y and g draw up to a twelfth of an em left of the pen,
  // 1.9 pixels for P in the speech's 22 points (TxSt 134), so a line that
  // began with one left that sliver of ink outside the next clear (seen in
  // the Spanish on 29 September 2026; the English does it too). The clear
  // now starts three pixels further left, at 112, a pixel to spare. The
  // names under the portraits lie inside the same rectangle: fitted to 84
  // pixels about x 64 they end by 107 with their outline and are not
  // reached; drawn up to 104 pixels by the name-fit fix they can reach 116,
  // and the shipped clear from 115 already took that tip, so the three
  // pixels more cost such a name what lies between 112 and 115 whenever the
  // speech is cleared without the portraits being drawn again. The copy to
  // 2136(31) is written as the constants it always
  // was (top 12, left 115, bottom 80, right 500) in the same eight words,
  // so the text keeps its place; r3 and r4 are the OffsetRect arguments
  // that follow, and r5 and r6 were only the copy's.
  { id: 'speech-clear', kind: 'fix', title: 'The conversation box clears the ink a line’s first letter draws left of the text',
    bug: 'A sliver of a letter is left at the start of a line in the conversation box',
    sites: [
      { at: 0x3D56C, was: [0x38800067], asm: ['li 4, 100             ; was 103: the clear from 112, once offset'] },
      { at: 0x3D5C8, was: [0x80C1004C, 0x38000050, 0x80A10050, 0x387F0858, 0x38800000, 0x90DF0858, 0x90BF085C, 0xB01F085C],
        asm: ['lis 0, 12              ; top 12', 'ori 0, 0, 115          ; left 115, where the text has always begun', 'stw 0, 2136(31)',
              'lis 0, 80              ; bottom 80', 'ori 0, 0, 500          ; right 500', 'stw 0, 2140(31)',
              'addi 3, 31, 2136       ; OffsetRect(2136(31), 0, ...), as before', 'li 4, 0'] }] },

  // ---- Hooks ----------------------------------------------------------------
  { id: 'hook-take', kind: 'hook', method: 241, title: 'Method 241 on where a thing is being put, with the thing, before it is weighed: False refuses, True puts it unweighed',
    sites: [{ at: 0x541EC, was: [0x5740063F], asm: ['b @cave               ; was clrlwi. 0, 26, 24'] }],
    cave: [
      'extsh. 5, 28', 'ble @none             ; nowhere to call', 'stwu 1, -64(1)', 'cmpwi 5, 256', 'bge @prop', 'oris 5, 5, 16448      ; a character, 0x4040', 'b @thing',
      'prop:', 'oris 5, 5, 16384      ; a thing, 0x4000', 'thing:', 'extsh 6, 29', 'oris 6, 6, 16384',
      'addi 3, 1, 56', 'li 4, 241', 'bl @DoInterp__7TInterpFs5VAddr5VAddr',
      'lwz 0, 56(1)', 'addi 1, 1, 64',
      'lwz 3, -30416(2)', 'lwz 3, 0(3)', 'cmpw 0, 3', 'beq @none              ; None: as before',
      'lwz 3, -29712(2)', 'lwz 3, 0(3)', 'cmpw 0, 3', 'bne @taken',
      'b @0x54578            ; False: refused',
      'taken:', 'b @0x54254            ; anything else: taken, unweighed',
      'none:', 'clrlwi. 0, 26, 24', 'b @0x541F0'] },

  { id: 'hook-corpse', kind: 'hook', method: 242, title: 'Method 242 on a dying creature or character: a number is its corpse’s type and aspect word, 0 for none',
    sites: [{ at: 0x46B70, was: [0x807F0004], asm: ['b @cave               ; was lwz 3, 4(31)'] }],
    cave: [
      'lhz 5, 80(1)          ; its character entry, as Die keeps it', 'stwu 1, -64(1)', 'oris 5, 5, 16448',
      'addi 3, 1, 56', 'li 4, 242', 'bl @DoInterp__7TInterpFs5VAddr', 'lwz 0, 56(1)', 'addi 1, 1, 64',
      'lwz 3, 4(31)          ; the unit, as NewProp is handed it', 'srwi. 4, 0, 28', 'beq @number', 'b @0x46B74            ; not a number: the unit’s own',
      'number:', 'sth 0, 130(1)', 'b @0x46B7C'] },

  { id: 'hook-load', kind: 'hook', method: 243, title: 'Method 243 on the hero each time a game is begun, opened or reverted to',
    sites: [{ at: 0x14654, was: [0x80010068], asm: ['b @cave               ; was lwz 0, 104(1)'] }],
    cave: [
      'stwu 1, -64(1)', 'stw 3, 60(1)          ; OpenPlayerFile returns what BeginPlay leaves',
      'lwz 5, -30356(2)', 'lha 5, 0(5)', 'oris 5, 5, 16448',
      'addi 3, 1, 56', 'li 4, 243', 'bl @DoInterp__7TInterpFs5VAddr',
      'lwz 3, 60(1)', 'addi 1, 1, 64', 'lwz 0, 104(1)', 'b @0x14658'] },

  // ---- Text and menus -------------------------------------------------------------
  { id: 'text-wieldable', kind: 'text', title: '"weildable" [sic] reads "wieldable"',
    data: [{ at: 0xC953C, was: '(Not weildable)', now: '(Not wieldable)' }] },
  { id: 'text-yourself', kind: 'text', title: '"your self" [sic] reads "yourself"',
    data: [{ at: 0xC9FF8, was: 'It isn\'t worth killing your self over...\n', now: 'It isn\'t worth killing yourself over...\n' }] },
  { id: 'text-monitor', kind: 'text', title: '"currently monitor" [sic] reads "monitor currently"',
    data: [{ at: 0xC8901, was: 'No suitable currently monitor available', now: 'No suitable monitor currently available' }] },
  { id: 'text-compatible', kind: 'text', title: '"not compatible this scenario" [sic] reads "not compatible with scenario"',
    data: [{ at: 0xC8B9D, was: 'This patch is not compatible this scenario', now: 'This patch is not compatible with scenario' },
           { at: 0xC8C57, was: 'This player is not compatible this scenario', now: 'This player is not compatible with scenario' }] },
  { id: 'text-berserk', kind: 'text', title: 'The strategy "Beserk" [sic] reads "Berserk"', bug: '"Beserker" [sic] and "Beserk" [sic]',
    rsrc: [{ type: 'STR#', id: 502, index: 4, was: 'Beserk', now: 'Berserk' }] },
  { id: 'text-celestial', kind: 'text', title: '"celstial" [sic] reads "celestial" in the sundial’s help',
    rsrc: [{ type: 'STR#', id: 503, index: 5, was: 'celstial', now: 'celestial' }] },
  { id: 'menus', kind: 'menu', title: 'The Audio and Preferences menus in the menu bar, and with them the frame-rate limit',
    bug: 'Hidden menus',
    rsrc: [{ type: 'MBAR', id: 128, was: [0x00, 0x02, 0x00, 0x80, 0x00, 0x81], now: [0x00, 0x04, 0x00, 0x80, 0x00, 0x81, 0x00, 0x83, 0x00, 0x88] }] },
];
