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

  { id: 'weight-contents', kind: 'fix', title: 'GetWeight weighs the type alone, not also the load of whatever has the type’s number',
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

  { id: 'sleep-hidden', kind: 'fix', title: 'A character not yet drawn, moved in a quick passage of time to a post on the party’s level, waits there as an egg instead of hidden',
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
  // about two pixels at the conversation's size, so a line that began with
  // one left that sliver of ink outside the next clear (seen in the Spanish
  // on 29 September 2026; the English does it too). The clear now starts
  // four pixels further left, at 111; the name under a portrait is fitted
  // to 84 pixels about x 64, so it ends by 107 with its outline and is not
  // reached. The copy to 2136(31) is written as the constants it always
  // was (top 12, left 115, bottom 80, right 500) in the same eight words,
  // so the text keeps its place; r3 and r4 are the OffsetRect arguments
  // that follow, and r5 and r6 were only the copy's.
  { id: 'speech-clear', kind: 'fix', title: 'The conversation box clears the ink a line’s first letter draws left of the text',
    bug: 'A sliver of a letter is left at the start of a line in the conversation box',
    sites: [
      { at: 0x3D56C, was: [0x38800067], asm: ['li 4, 99              ; was 103: the clear from 111, once offset'] },
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
