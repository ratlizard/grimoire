/* ROUTINE_NOTES: what each routine of the program does, in plain words, by
   class, with the class's opening and each routine's text, keyed by the
   routine's entry (an offset into the code section, as everywhere on the
   site).

   Written by a script, the workbench's tools/fnpublish.py, from its
   doc/functions/, where every claim was read from the instructions twice and
   cites the instructions that show it. Change the words there, not here.
   The page shows a text on the routine's page above its listing, each
   address in it a link that rings the instruction in the visitor's copy of
   the program (renderAppPefSheet, routineNoteHTML). The smoke's routine
   notes block checks that every cited address lies in the routine its text
   is under. Text in backticks is a name or an address, *stars* a title, and
   a line starting "- " an item of a list. */
const ROUTINE_NOTES = {
 "TSegFile": {
  "opening": "One archive file, such as `Cythera Data` or a saved game, open for reading and\nwriting. The object has the file's reference number at `+0`, a byte at `+2`\nthat the object sets when the table of contents changes and clears when it\nwrites the table, a byte at `+3` that is 1 while the file accepts no saves, the\ntime the object opened the file at `+4` (`GetDateTime`, `0x079698`) and from\n`+8` the addresses of 256 pages of the table of contents, 0 for a page not in\nmemory.\n\nThe file starts with a header of 128 bytes. Page 0 of the table follows at\noffset 128, 2,048 bytes (`TSegFile::BlankFile`, `0x079B64` to `0x079B90`). A\npage has 256 entries of 8 bytes, a segment's offset in the file and its length.\nA resource's id picks page `id >> 8` and entry `id & 0xFF` of it\n(`TSegFile::LoadSegment`, `0x079F70` and `0x079F8C`). The file stores page n,\nfrom 1 to 255, as the segment with id n, so entry n of page 0 locates it\n(`TSegFile::LoadTOC`, `0x079C9C` to `0x079D0C`). Entry 0 of page 0 gives the\nplace of page 0 itself, offset 128, and resources from `0x0100` up are the\nfile's contents.",
  "routines": [
   {
    "name": "TSegFile::IsSegFile",
    "entry": 497116,
    "text": "Returns 1 when an open file is an archive, which is when the 4-byte word at\noffset 128, the first entry of page 0, is 128 (`0x079620`), and 0 otherwise."
   },
   {
    "name": "TSegFile::TSegFile",
    "entry": 497268,
    "text": "Opens an archive on a file already open. An empty file becomes a new archive\n(`BlankFile`, `0x0796D0`), and the byte at `+2` goes to 1. For any other file\nit reads the table into memory (`LoadTOC`, `0x0796E8`)."
   },
   {
    "name": "TSegFile::TSegFile",
    "entry": 497460,
    "text": "Makes a new archive at a file location, deleting any file there (`FSpDelete`,\n`0x079770`), creating it with the creator and type given (`FSpCreate`,\n`0x079778` to `0x079788`), opening its data fork for reading and writing\n(`FSpOpenDF`, `0x07979C`) and writing an empty archive (`BlankFile`)."
   },
   {
    "name": "TSegFile::~TSegFile",
    "entry": 497668,
    "text": "Writes the table when it has changed (`SaveTOC`, `0x079834`), closes the file\n(`FSClose`, `0x079840`), frees every page of the table and frees the object when\nthe flag is above 0."
   },
   {
    "name": "TSegFile::Lock",
    "entry": 497920,
    "text": "Sets the byte at `+3` to 1, after which a save throws."
   },
   {
    "name": "TSegFile::Unlock",
    "entry": 497968,
    "text": "Sets the byte at `+3` to 0."
   },
   {
    "name": "TSegFile::DeleteTOCPage",
    "entry": 498020,
    "text": "Frees a page of the table (`free`), unless it is 0."
   },
   {
    "name": "TSegFile::NewTOCPage",
    "entry": 498144,
    "text": "Allocates a page of the table, 2,048 bytes of zeros (`malloc`, `0x0799F4`), and\nthrows \"Could not allocate segfile TOC page\" when there is no memory."
   },
   {
    "name": "TSegFile::BlankFile",
    "entry": 498296,
    "text": "Empties the file (`SetEOF` of 0, `0x079A9C`) and writes a new archive, a header\nof 128 zeros (`0x079B00`) and page 0 of the table with only entry 0, which\ngives page 0's place, offset 128 and length 2,048 (`0x079B64` to `0x079B90`).\nIt returns the File Manager's error, or -108 when there is no memory for the\nheader."
   },
   {
    "name": "TSegFile::LoadTOC",
    "entry": 498656,
    "text": "Reads the table into memory, page 0 from offset 128 (`0x079C38`, `0x079C6C`) and\nthen each page whose entry in page 0 has a length (`0x079C9C` to `0x079D0C`).\nIt reads the entry's length of bytes into a page of 2,048 (`0x079CEC`), so a\nlength above 2,048 would run past the page. It returns the File Manager's\nerror, if any."
   },
   {
    "name": "TSegFile::SaveTOC",
    "entry": 499072,
    "text": "Writes the table. It saves each page from 1 to 255 that has an entry of nonzero\nlength as segment n (`SaveSegment`, `0x079E14`), and frees a page with none and\nclears its entry in page 0 (`0x079E48` to `0x079E90`). Then it writes page 0 at\noffset 128 (`0x079EE4`) and clears the byte at `+2`."
   },
   {
    "name": "TSegFile::LoadSegment",
    "entry": 499532,
    "text": "Reads a whole segment into a buffer, the entry's length of bytes from its\noffset (`FSRead`, `0x079FE0`). The buffer has to be large enough, since nothing\nhere checks it. A resource with no page or a length of 0 gives -50\n(`0x07A008`)."
   },
   {
    "name": "TSegFile::LoadSegment",
    "entry": 499796,
    "text": "Reads part of a segment, a length from an offset into it, into a buffer\n(`0x07A0B8` to `0x07A144`). A missing resource fills the buffer with zeros and\nreturns -43 (`0x07A164`, `0x07A17C`). When the length given is greater than the\nsegment's whole length, it zeros from the buffer's start plus the offset plus\nthe segment's length, for the length given less the segment's length, and\nreads the segment's whole length from the offset (`0x07A0F8` to `0x07A134`).\nWith an offset above 0 that zeroing runs past the buffer's end by the offset,\nand the read goes beyond the segment. When the length given is not greater\nthan the segment's, nothing checks that the offset plus the length stays\ninside the segment. No call in the shipped game meets either case. Every\ncaller but `LoadLevelMap` passes an offset of 0, and `LoadLevelMap`'s reads end\nat the segment's end in the shipped scenario, so only a map edited to be\nshorter than the length in its header would meet it."
   },
   {
    "name": "TSegFile::LoadSegment",
    "entry": 500188,
    "text": "Reads a whole segment into a new handle, from the application heap\n(`NewHandle`, `0x07A238`) or else temporary memory (`TempNewHandle`,\n`0x07A250`). It returns 0 for a missing resource, when there is no memory, or\nwhen the read fails."
   },
   {
    "name": "TSegFile::SetSegmentLen",
    "entry": 500528,
    "text": "Sets a segment's length, making its page when the page is missing. A segment\nthat grows moves to the end of the file, which grows by the new length\n(`GetEOF`, `SetEOF`, `0x07A3D4` to `0x07A434`), and its bytes stay behind,\nuncopied. One that shrinks stays where it is with the new length (`0x07A444` to\n`0x07A458`). Either change sets the byte at `+2`."
   },
   {
    "name": "TSegFile::SaveSegment",
    "entry": 500912,
    "text": "Writes a whole segment. It throws \"Attempt to save segment to locked seg file\"\nwhile the byte at `+3` is 1 (`0x07A4D8` to `0x07A4F8`). A segment longer than\nits entry moves to the end of the file as `SetSegmentLen` moves it (`0x07A578`\nto `0x07A5E4`), one shorter stays where it is, and then the bytes go at the\nentry's offset (`0x07A624`, `0x07A650`). The space a moved segment had stays\nin the file until `Compact`."
   },
   {
    "name": "TSegFile::SaveSegment",
    "entry": 501440,
    "text": "Writes part of a segment, from an offset into it, inside its present length.\nIt throws while the byte at `+3` is 1. It cuts a length running past the\nsegment's end to that end (`0x07A748` to `0x07A760`). For a missing resource or\na length of 0 or less it writes nothing and returns -50 (`0x07A7E4`)."
   },
   {
    "name": "TSegFile::ReadHeader",
    "entry": 501808,
    "text": "Reads the file's 128-byte header from offset 0 into a buffer (`0x07A85C`, `0x07A888`)."
   },
   {
    "name": "TSegFile::WriteHeader",
    "entry": 501996,
    "text": "Writes a buffer of 128 bytes as the file's header at offset 0 (`0x07A918`, `0x07A944`)."
   },
   {
    "name": "TSegFile::Compact",
    "entry": 502184,
    "text": "Rewrites the archive without the space that moved segments left behind. It\nfinds the file (`PBGetFCBInfoSync`, `0x07A9F0`) and makes a copy beside it,\nits name the file's with one of the characters of \"~123456789\" added, the\nfirst such name that no file has (`0x07AA5C` to `0x07AB08`), with creator 'SdEd'\n(`FSpCreate`, `0x07AAC0`). Into the copy it writes the header and every\nsegment from `0x0100` up (`TSegFileIterator`, `0x07AB50`, `SaveSegment` at\n`0x07ABAC`). Then it copies the resource fork (`0x07AC6C` to `0x07ADB8`),\nhalving the buffer until an allocation succeeds. It exchanges the two files\n(`FSpExchangeFiles`, `0x07ADDC`), reopens the original and reads its new table\n(`0x07AE64`, `0x07AE98`), and deletes the copy, which then has the old contents\n(`FSpDelete`, `0x07AED0`). A failure to reopen throws \"Compacting seg file -\ncan't re-open copy\", and a failure to read the table \"Compacting seg file -\ncan't re-load TOC\". When files already have all ten names, it returns -50."
   },
   {
    "name": "TSegFile::Verify",
    "entry": 503972,
    "text": "Checks an open file's archive structure and returns a message, or 0 when it\nfinds nothing wrong. It returns \"Not a segfile\" when the first entry is not 128\n(`IsSegFile`, `0x07B0E4`) and \"Could not read master TOC\" when a read of page 0\nfails. It checks that each entry of page 0 has a length from 0 to 2,048 (\"Bad\nsize of TOC segment\", `0x07B1E0` to `0x07B204`), lies after the header and\ninside the file (\"TOC page out of file\", `0x07B25C` to `0x07B298`) and overlaps\nno other (\"Overlap of TOC segments\", `0x07B328` to `0x07B360`). Then it reads\neach page, returning \"Could not read sub TOC\" when a read fails (`0x07B40C` to\n`0x07B420`), and checks its entries the same way, with the length up to the\nfile's length, returning \"Preposterous size of data segment\", \"data segment\nout of file\" or \"Overlap of data segments\" (`0x07B450` to `0x07B5F0`). It\nstores the id of the entry it finds wrong in the global at toc -29508\n(`0x07B208`, `0x07B494`)."
   },
   {
    "name": "TSegFile::Encrypt",
    "entry": 506416,
    "text": "Enciphers or deciphers bytes in place with a resource's id as the key, the\nsame operation either way. From the id it makes a multiplier, the id times 4,\nlow byte, plus 1 (`0x07BA38`, `0x07BA40`), an increment, the id shifted right 6,\nlow byte (`0x07BA58`), and a starting state, the id with its high byte\nexclusive-ored in (`0x07BA5C`). It steps the state once for each byte to skip,\nthe fourth argument (`0x07BA64` to `0x07BA74`), which every caller passes as 0.\nThen for each byte it steps the state to the increment plus the state times\nthe multiplier and exclusive-ors the byte with the state's low byte\n(`0x07BA7C` to `0x07BA94`)."
   },
   {
    "name": "TSegFile::Decrypt",
    "entry": 506592,
    "text": "Calls `Encrypt` with the same arguments (`0x07BB0C`)."
   },
   {
    "name": "TSegFile::StreamSegment",
    "entry": 507040,
    "text": "Returns a record for reading a segment as a stream, the file's reference\nnumber, the segment's start offset twice (the start and the position to read\nnext) and its end offset (`0x07BCD4` to `0x07BCF4`), with the three offsets 0\nfor a missing resource (`0x07BCFC` to `0x07BD1C`). It builds the record below\nthe stack pointer (`0x07BCD8`), so the caller copies it before its next\ncall."
   }
  ]
 },
 "TCache": {
  "opening": "The memory for copies of resources, one block of the application heap made\ninto a heap zone. The object has its table of virtual routines at `+0`,\nthe block at `+4`, the zone at `+8` and the block used most recently at `+12`,\nthe head of a ring of every block in the zone.\n\nEach block is a handle in the zone with a header of 20 bytes before the data.\nThe header has the address of the owner's pointer at `+0`, which the cache\nsets to the data's address and clears when it frees the block, the handle at\n`+4`, the next older and the next newer block at `+8` and `+12`, a lock count\nat `+16` and flags at `+18`. Bit 0 of the flags means the cache writes the\nblock back before freeing it (`TCache::Free`, `0x07C984`).",
  "routines": [
   {
    "name": "TCache::TCache",
    "entry": 509316,
    "text": "Makes a cache of a size given, allocating the memory (`NewPtr`, `0x07C5BC`) and\nmaking it a zone with 1,024 master pointers (`InitZone`, `0x07C608`,\n`0x07C610`). No memory throws (`0x07C5F4`)."
   },
   {
    "name": "TCache::Allocate",
    "entry": 509556,
    "text": "Allocates a block of a size given for an owner's pointer and returns the data's\naddress. When the zone is full (`NewHandle`, `0x07C6CC`) it frees the oldest\nblock whose lock count is 0 or less and tries again (`0x07C70C` to\n`0x07C770`). It returns 0 when the ring is empty and the allocation still\nfails (`0x07C6E8` to `0x07C6F0`). It throws when every block has a lock count\nabove 0 (`0x07C738`), and nothing reaches the second throw after that one\n(`0x07C750`). The new block goes at the head of the ring as the newest\n(`0x07C7EC` to `0x07C83C`). Then the cache sets every block's owner pointer to\nits data's address again, since a block can have moved (`0x07C840` to\n`0x07C880`)."
   },
   {
    "name": "TCache::GetMyHandle",
    "entry": 510172,
    "text": "Returns the handle of a block from its data's address, the word 16 bytes before it, or 0 for 0."
   },
   {
    "name": "TCache::WriteBlock",
    "entry": 510240,
    "text": "Does nothing. `Free` calls it, as the virtual routine at offset 8, for a block with bit 0 of its flags set."
   },
   {
    "name": "TCache::Free",
    "entry": 510288,
    "text": "Frees a block by its data's address. For a block with bit 0 of its flags set it\nfirst calls the virtual routine at offset 8 (`0x07C9A0`). The block leaves the\nring, the cache clears its owner's pointer (`0x07CA04`) and disposes of the\nhandle (`0x07CA0C`). With the third argument set, the cache then sets every\nother block's owner pointer to its data's address again (`0x07CA2C` to\n`0x07CA60`)."
   },
   {
    "name": "TCache::Lock",
    "entry": 510624,
    "text": "Adds 1 to a block's lock count and locks its handle (`HLock`, `0x07CAE0`), so that `Allocate` passes it over."
   },
   {
    "name": "TCache::Unlock",
    "entry": 510760,
    "text": "Subtracts 1 from a block's lock count and unlocks its handle when the count reaches 0 (`HUnlock`, `0x07CB7C`)."
   },
   {
    "name": "TCache::Touch",
    "entry": 510920,
    "text": "Moves a block to the head of the ring as the newest (`0x07CC00` to `0x07CC70`),\nso that the cache frees it last. When the ring is empty once the block is out,\nit calls `DebugStr` with \"Touching a block not in the cache\" (`0x07CC34`) and\nmakes the block the only one."
   }
  ]
 },
 "TCachedSegFiles": {
  "opening": "The archives open at once, merged into one table, with a cache of the\nresources read from them. The scenario's `Cythera Data` and the saved game are\ntwo of them. The object has the cache (`TCache`) at `+0`, up to 16 open\narchives (`TSegFile`) from `+4`, the newest first, and from `+68` the\naddresses of 256 pages of the merged table. A page has 256 entries of 8 bytes,\nthe address of the resource's copy in the cache (0 for none) and the\nresource's source archive, with the id picking the entry as in `TSegFile`.\n\nEvery save goes to the newest archive, at `+4` (`TCachedSegFiles::SaveSegment`,\n`0x07D75C`). The program reaches the one object through the global at toc\n-30396.",
  "routines": [
   {
    "name": "TCachedSegFiles::TCachedSegFiles",
    "entry": 511148,
    "text": "Makes the object for a cache given, with no archives and an empty table."
   },
   {
    "name": "TCachedSegFiles::AddFile",
    "entry": 511312,
    "text": "Adds an archive as the newest. The others move down one place, and a\nsixteenth falls off the list (`0x07CD78` to `0x07CD9C`). Then it points every\nresource from `0x0100` up that the archive has at the archive (`SetEntry`,\n`0x07CDDC`), so each resource's source is the newest archive that has it."
   },
   {
    "name": "TCachedSegFiles::NewTOCPage",
    "entry": 511568,
    "text": "Allocates a page of the merged table, 2,048 bytes of zeros (`malloc`, `0x07CE6C`), and throws when there is no memory."
   },
   {
    "name": "TCachedSegFiles::SetEntry",
    "entry": 511776,
    "text": "Points a resource at an archive, making its page when the page is missing.\nWhen the archive differs from the entry's, it frees the resource's copy in the\ncache (`TCache::Free`, `0x07CFAC`). When the archive matches, a copy in the\ncache stays as it is (`0x07CF88`)."
   },
   {
    "name": "TCachedSegFiles::GetSegment",
    "entry": 512012,
    "text": "Returns the address of a resource's copy in the cache, reading the resource in\nfirst when there is no copy. It makes a copy already there the newest\n(`TCache::Touch`, `0x07D05C`). Otherwise it allocates a block of the resource's\nlength (`TCache::Allocate`, `0x07D0D0`) and reads the resource into it as the\nfile has it (`TSegFile::LoadSegment`, `0x07D0E4`). It returns 0 for a\nresource no archive has."
   },
   {
    "name": "TCachedSegFiles::GetEncryptedSegment",
    "entry": 512328,
    "text": "Returns the address of a resource's deciphered copy in the cache. It does what\n`GetSegment` does and then deciphers the bytes it read (`TSegFile::Decrypt`,\n`0x07D238`). It returns a copy already in the cache as it is, so the copy has\ndeciphered bytes only when this routine, rather than `GetSegment`, read it in\nfirst."
   },
   {
    "name": "TCachedSegFiles::GetSegmentLength",
    "entry": 512676,
    "text": "Returns a resource's length in its source archive, or 0 for a resource no archive has."
   },
   {
    "name": "TCachedSegFiles::Exists",
    "entry": 512904,
    "text": "Returns 1 when a resource's source archive has an offset for it other than 0\n(`0x07D3FC`), and 0 otherwise."
   },
   {
    "name": "TCachedSegFiles::LoadSegment",
    "entry": 513112,
    "text": "Copies a whole resource into a buffer. It moves a copy in the cache into the\nbuffer (`BlockMove`, `0x07D4FC`) and then reads the resource from its archive\ninto the same buffer (`TSegFile::LoadSegment`, `0x07D568`), so the buffer ends\nwith the bytes as the file has them."
   },
   {
    "name": "TCachedSegFiles::LoadSegment",
    "entry": 513468,
    "text": "Copies part of a resource, from an offset, into a buffer, first from the\ncache (`BlockMove`, `0x07D624`) and then from its archive\n(`TSegFile::LoadSegment` at `0x07A054`, called at `0x07D64C`)."
   },
   {
    "name": "TCachedSegFiles::SetSegmentLen",
    "entry": 513696,
    "text": "Sets a resource's length in the newest archive (`TSegFile::SetSegmentLen`, `0x07D6D8`) and points the resource at that archive (`SetEntry`, `0x07D6EC`)."
   },
   {
    "name": "TCachedSegFiles::SaveSegment",
    "entry": 513856,
    "text": "Writes a whole resource to the newest archive (`TSegFile::SaveSegment`, `0x07D780`) and points the resource at it (`SetEntry`, `0x07D794`)."
   },
   {
    "name": "TCachedSegFiles::SaveSegment",
    "entry": 514024,
    "text": "Writes part of a resource to the newest archive (`TSegFile::SaveSegment` at `0x07A6C0`, called at `0x07D830`) and points the resource at it (`SetEntry`, `0x07D844`)."
   },
   {
    "name": "TCachedSegFiles::SaveEncryptedSegment",
    "entry": 514200,
    "text": "Writes a resource enciphered to the newest archive. It enciphers the bytes in\nplace (`TSegFile::Encrypt`, `0x07D8E0`), writes them (`0x07D8F8`), deciphers\nthem again (`0x07D910`) and points the resource at that archive (`SetEntry`,\n`0x07D924`)."
   },
   {
    "name": "TCachedSegFiles::RefindSegment",
    "entry": 514440,
    "text": "Looks again for the source archive of a resource. It frees the cached copy\nof entry 0 of the resource's page, not the resource's entry (the load\nat `0x07D9BC`, `TCache::Free` at `0x07D9D4`), and clears the resource's\narchive (`0x07D9F0`). Then it goes through the archives from the newest\n(`0x07D9FC` to `0x07DA94`) and points the resource at each one that has it,\nwithout stopping, so it ends at the oldest that has it. The resource's\ncopy in the cache stays."
   },
   {
    "name": "TCachedSegFiles::Flush",
    "entry": 514788,
    "text": "Writes the newest archive's table when it has changed (`TSegFile::SaveTOC`,\n`0x07DB1C`), and otherwise flushes the file (`PBFlushFileSync`,\n`0x07DB34`)."
   },
   {
    "name": "TCachedSegFiles::RemoveFile",
    "entry": 514948,
    "text": "Removes an archive from the list, moving the later ones up (`0x07DBAC` to\n`0x07DBFC`). For each resource whose source it was and that has a copy in the\ncache, it frees the copy and clears the source (`0x07DC40` to `0x07DC78`). A\nresource with no copy in the cache still points at the removed archive. Then\nit points every resource of every remaining archive at that archive, from the\noldest to the newest (`SetEntry`, `0x07DD0C`), which leaves each resource that\nanother archive has with the newest of those as its source."
   },
   {
    "name": "TCachedSegFiles::HomeSegFile",
    "entry": 515468,
    "text": "Returns a resource's source archive, or 0."
   }
  ]
 },
 "TInterp": {
  "opening": "The interpreter of the game's scripts, the byte code in `Cythera Data` that\ngrimoire's script view disassembles, with the mnemonics of its opcode table\n(`DVM_OPS` in `js/delv-script.js`). One object runs one script resource. It has\nthe arguments' base on the value stack at `+0`, the locals' base at `+4`, the\nscript's deciphered bytes at `+8` and the resource's id at `+12` (the\nconstructor, `0x0833C0`).\n\nValues are `VAddr` words, with their types in `VAddr`. The value stack is one\narray for all interpreters, its base in the global at toc -29440 and its depth\nin the halfword at toc -29444 (`data+0x72750`). True, False and None are the\nwords in the globals at toc -29844, -29712 and -30416. A pending exception is\nthe pointer in the global at toc -29436. While that pointer is not 0, both\nroutines that read opcodes return at their next opcode (`DoExpr`, `0x07DE4C`,\nand `DoInterpAt`, `0x080D78`), and the interpreter's destructor throws the\nexception (`0x083544`).\n\nThe interpreter evaluates expressions in one routine (`DoExpr`) and runs\nstatements in another (`DoInterpAt`). Expression opcodes 0x40 to 0x9F go\nthrough a jump table at toc +5236 (`0x07DE78`), and statement opcodes through a\nchain of compares (`0x080DD8`). A system call is opcode 0xA0 up, entry `opcode -\n0xA0` of a table of 96 routine pointers at toc +8176 (`0x0806D0`), from\n`RangeIter` (0xA0) to `cbDebugStr` (0xFE), each with its name in the program.",
  "routines": [
   {
    "name": "TInterp::DoExpr",
    "entry": 515580,
    "text": "Evaluates one expression, pushing its value onto the value stack. It reads\nopcodes from the program counter its second argument points at until the\nexpression ends (opcode 0x40, `0x07DE8C`). The opcodes do as follows.\n\n- Opcodes 0x00 to 0x2F push a local, from `+4` (`0x080620`), and 0x30 to 0x3F\n  push an argument, from `+0` (`0x08066C`).\n- The `byte`, `short` and `word` opcodes push a constant of 28 bits. For a\n  `word` of type 1 the routine adds the value stack's frame (`0x07DF84`).\n- The `string` and `data` opcodes push a far address to the bytes inline in\n  the script, and skip them (`0x07DFE8`, `0x07E07C`).\n- The `load_far_word` opcode reads the 4-byte word at a resource and an offset,\n  through `TCachedSegFiles::GetEncryptedSegment` (`0x07E170`, `lwzx` at\n  `0x07E1BC`), and throws \"Can't fetch global from segment\" when the segment is\n  missing. The `load_near_word` opcode reads a word of the current script\n  (`0x07E318`).\n- The `global` opcode pushes `GetGlobal` of its number (`0x07E2B0`).\n- The `index` opcode pushes `At` of an object and an index, or None when the\n  object is a number (`0x07E398`).\n- The `has_member` opcode pushes True when the object is a game object (type 4)\n  whose class answers the method, through `Dispatch` (`0x07E4B8`), and False\n  otherwise. The `class_member` opcode pushes what the class has under that\n  number.\n- The `get_field` opcode reads a game object's field through `GetField`\n  (`0x07E6EC`). The `cast` opcode turns a number into a reference to an object\n  of the type given, and converts another object through `Ctor` (`0x07E86C`).\n  The `is_type` opcode pushes True for a game object of that class.\n- The `add` and `sub` opcodes work on numbers, add a number to a game object's\n  id or a type-3 value's low 12 bits (`0x07F36C`, `0x07F3EC`), and push the\n  left value for any other pair. The `div` and `mod` opcodes give 0 when\n  dividing by 0 (`0x07F8E0`). The comparisons give True or False for two\n  numbers and push the left value for any other pair (`0x07FB1C`, `0x07FB84`).\n  The `eq` and `ne` opcodes compare through `IsEqual` (`0x07FF6C`).\n- The `gui` opcode with 0 converts a value. With a number n it evaluates its\n  arguments and makes a scripted window object through `CreateSysObj`\n  (`0x07EA7C`).\n- The `call_subroutine` opcode runs a routine of the same script (`DoInterpAt`,\n  `0x07EB54`), and the `call_resource` opcode a whole script in a new\n  `TInterp` (`0x07EBF4`). The `call_index` opcode runs the routine a value\n  points at, a script (type 6) or a far address into one.\n- The `method` opcode sends a method to the object that is its first\n  argument. A game object runs its class's script for the method, through\n  `Dispatch` (`0x07F084`), or the default script, resource `0x3000` plus the\n  method's number (`0x07F108`), when its class has none. A system object goes\n  to `DispatchSysObj` (`0x07F004`) and a heap object to `DispatchHeapObj`\n  (`0x07F1D8`). Any other value is the result itself (`0x07F254`).\n- Opcodes 0xA0 and up are the system calls (`0x0806E4`).\n\nAny other opcode throws \"Bad expr opcode\" (`0x080780`)."
   },
   {
    "name": "TInterp::IsTrue",
    "entry": 526692,
    "text": "Returns whether a value counts as true in a condition. True, a number other\nthan 0, a game object (type 4), a type-2 or type-3 value and a far address are\ntrue. False, None, 0 and every other type, a heap object (type 7) among them,\nare false (`0x080A08` to `0x080AA8`)."
   },
   {
    "name": "TInterp::IsEqual",
    "entry": 527068,
    "text": "Returns whether two values are equal. When both are strings (`IsString`) it\ncompares their text (`strcmp`, `0x080B3C`). Otherwise it compares the words."
   },
   {
    "name": "TInterp::DoInterpAt",
    "entry": 527512,
    "text": "Runs the statements of a script from an offset until a `return`, an `exit` or\na pending exception, and stores the result through its first argument. The\nstatements do as follows.\n\n- The `subroutine` statement opens a routine, reserving its locals on the\n  value stack (`0x080ED0`).\n- The `set_local` statement writes a local or an argument (`0x080F40`,\n  `0x080FA8`). The `write_near_word` statement writes a word of the script in\n  memory, and nothing saves it (`0x081178`). The `write_far_word` statement\n  writes the 4-byte word at a resource and an offset in the deciphered copy and\n  saves the resource enciphered to the most recently added archive\n  (`0x080FB0`, `stwx` at `0x081088`, `SaveEncryptedSegment` at `0x0810B0`). For\n  a missing resource it throws \"Can't set global in segment\" (`0x0810F4`).\n- The `set_index` statement stores through `AtPut` only for a number from 0\n  below the object's length (`0x081214` to `0x081278`), so it never makes a\n  list longer. The `set_field` statement writes a game object's field\n  (`SetField`, `0x08132C`) and the `set_global` statement a global\n  (`SetGlobal`, `0x081388`).\n- The `branch` statement jumps to an offset (`0x0813D8`). The `switch`\n  statement jumps through a table of offsets for a number from 0 below the\n  table's count, and past the table for any other value (`0x081434` to\n  `0x081498`).\n- The `if` statement jumps to its target when the condition is true. The\n  `if_not` statement runs what follows when the condition is true and jumps to\n  its target when it is false (`IsTrue`, `0x0818F0` and `0x081990`).\n- The `print` statement writes a value to the message pane, a number by \"%d\",\n  True, False and None as \"true\", \"false\" and \"None\", a game object by\n  `PrintObj`, and a global string or a string as its text, through\n  `HandleMapping` and `OutStr` (`0x081504` to `0x081750`). A byte below 0x80\n  in place of a statement starts text to print in the same way (`0x082368`).\n- The `return` statement stores its value as the result and ends the routine\n  (`0x0817C8`).\n- The `exit` statement calls the conversation object's virtual routines at\n  offsets 260 and 276, the second with the input's 64 bytes (`0x081A04` to\n  `0x081A28`), and puts \"bye\" in the input when it is still empty (`0x081A30`\n  to `0x081A44`). The `conversation_prompt` statement reads a prompt's text\n  (`0x081A5C`). For a prompt starting with `*` the player types a line into the\n  input through routine 276 (`0x081AA4`). Any other prompt goes to routine 280,\n  and the one character that routine returns becomes the input (`0x081AD4` to\n  `0x081B04`). The `conversation_response` statement jumps to its target when\n  the input starts with one of its comma-separated keywords, or the keyword is\n  `*` (the runtime's `strncmp`, called at `0x081BA4`). It skips no space after\n  a comma, so a keyword written after \", \" needs a space typed first. Parium's,\n  Crito's and Apis's lists, \"inn, pari\", \"inn, crit\" and \"inn, apis\", are such\n  lists.\n- The `ai_state` statement makes an exception of 16 bytes, with \"Raise\", the\n  state's number and a value, and sets it pending (`0x081C64` to `0x081CB8`).\n  The interpreter then returns at its next opcode, and its destructor throws\n  the exception. The `gui_close` statement releases a heap object or deletes a\n  system object (`0x08184C`, `0x0818AC`).\n- The calls run as in `DoExpr`, and the routine drops the result. A system\n  call as a statement works the same way (`0x0823EC`).\n\nAny other opcode throws \"Bad statement opcode\" (`0x082464`). When an\nexception passes through, the value stack goes back to the routine's frame and\nthe result is None (`0x0824F8` to `0x082580`)."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534104,
    "text": "Runs a method of an object with no arguments, pushing the object and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534260,
    "text": "Runs a method of an object with one argument, pushing both and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534472,
    "text": "Runs a method of an object with two arguments, pushing all three and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534724,
    "text": "Runs a method of an object with four arguments, pushing all five and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterpRoutine",
    "entry": 535052,
    "text": "Runs a whole script resource from its start with three arguments, in a new\n`TInterp` (`0x082AA0`, `DoInterpAt` at `0x082AC4`)."
   },
   {
    "name": "TInterp::DoInterp0",
    "entry": 535348,
    "text": "Runs a method of an object whose arguments are on the value stack, as the\n`method` opcode does, through a game object's class script, the default script\n`0x3000` plus the method (`0x082C4C`), `DispatchSysObj`, or `DispatchHeapObj`.\nIt also runs a far address as a routine at that offset (`0x082D7C`) and a\ntype-6 value as a whole script (`0x082E34`). Any other value gives None."
   },
   {
    "name": "TInterp::Dispatch",
    "entry": 536284,
    "text": "Looks up a method in a class's script. It deciphers the class script\n(`GetEncryptedSegment`, `0x082F04`), whose first halfword is the offset of its\ntable of methods, and returns 1 with the entry for the method (`At`,\n`0x082F40`) when it is not None, and 0 otherwise or when the class has no\nscript."
   },
   {
    "name": "TInterp::GetString",
    "entry": 536496,
    "text": "Copies text from a script into a buffer, up to a zero byte or a byte of 0x80 or\nabove, which is where the next opcode starts (`0x082FD4`), and returns the\naddress after it."
   },
   {
    "name": "TInterp::VAddrToPtr",
    "entry": 536604,
    "text": "Returns a pointer for a value, by its type through a jump table at toc +5620\n(`0x083080`). A far address points into its deciphered segment (`0x0830A4`). A\nframe reference points into the value stack (`0x0830C4`). An element of an\narray in a script resource points at that element. A global string comes from\n`GetGlobStr`. A game object gives its name (`SysObjToString`, or its method 2,\n`0x0831D8`). A heap string gives its characters. True, False and None give\n\"True\", \"False\" and \"None\" (`0x083258` to `0x0832A4`), where `print` writes\n\"true\" and \"false\". Any other value throws."
   },
   {
    "name": "TInterp::TInterp",
    "entry": 537532,
    "text": "Makes an interpreter for a script resource. It deciphers the script\n(`GetEncryptedSegment`, `0x083400`) and locks it in the cache while the object\nlives (`TCache::Lock`, `0x08341C`), sets the frame to the top of the value\nstack, and discards any pending exception (`0x083460` to `0x083484`)."
   },
   {
    "name": "TInterp::~TInterp",
    "entry": 537808,
    "text": "Unlocks the script (`TCache::Unlock`, `0x083508`). When an exception is\npending it throws it (`0x083544`), which is how a raise leaves the routine\nthat ran the script."
   },
   {
    "name": "TInterp::Len",
    "entry": 538028,
    "text": "Returns a value's length, 0 for a number, a heap object's length, a game\nobject's answer to method 3 (`0x083684`, `0x0836AC`), an array's count in a\nscript resource, or a string's `strlen`."
   },
   {
    "name": "TInterp::At",
    "entry": 538520,
    "text": "Returns the element at an index, through a game object's method 4\n(`0x083864`, `0x08388C`), a heap object's `At` (`0x0838E4`), or the byte of a\nstring or the element of an array in a script resource. A number or None gives\nNone."
   },
   {
    "name": "TInterp::AtPut",
    "entry": 539316,
    "text": "Stores a value at an index, through a heap object's `AtPut` (`0x083B48`), a\ngame object's method 5 (`0x083BD4`, `0x083C00`), or, for an array in a script\nresource, the word at the index in memory, with no check of the index against\nthe array's count (`0x083C58`). The `set_index` statement checks the length\nfirst. A number or None stays as it is."
   },
   {
    "name": "TInterp::HasProperty",
    "entry": 540472,
    "text": "Returns the entry a class's script has for a method or property, through `Dispatch`, or None."
   },
   {
    "name": "TInterp::GetProperty",
    "entry": 540648,
    "text": "Returns the element at an index of what a class's script has under a number (`Dispatch`, then `At`, `0x084048`), or None."
   },
   {
    "name": "TInterp::IsString",
    "entry": 605716,
    "text": "Returns the characters of a value that is a string, or 0. A far address or\ntype-3 value whose bytes are text, a heap string (`0x093F04`) and global\nstrings 1, 2 and 10 (`GetGlobStr`, `0x093F14` to `0x093F40`) are strings. It\nreturns 0 for numbers and every other value."
   }
  ]
 },
 "TStyleRun": {
  "opening": "One run of text in a single style, a node of the list that a `TTextContext`\nbuilds, 20 bytes. It has the run's x on its line at `+0` (a short, 0 for the\nfirst run of a line), its width in pixels at `+2`, its text style (an index for\n`SetText`) at `+4`, a byte at `+6` that is 1 for a highlighted keyword, a byte\nat `+7` that is 1 when the keyword's word goes on into the next run, the text's\naddress at `+8`, its length at `+12` and the next run at `+16`.",
  "routines": [
   {
    "name": "TStyleRun::TStyleRun",
    "entry": 482232,
    "text": "Makes the first run of a text, at x -1, in style 5, not highlighted and empty (`0x075BB8` to `0x075BF4`)."
   },
   {
    "name": "TStyleRun::TStyleRun",
    "entry": 482340,
    "text": "Makes a run after another one, copying its 20 bytes, linking itself in after\nit (`0x075C50`) and starting at the text address given with a length of 0\n(`0x075C54`, `0x075C58`)."
   },
   {
    "name": "TStyleRun::Draw",
    "entry": 482452,
    "text": "Draws the run at a line's position, in its style (`SetText`, `0x075CBC`). With\nthe text color 33 (black) it draws plain text (`AADrawText`, `0x075D1C`), in the\nhighlight color when the run is a keyword (`0x075CC8` to `0x075CD8`). With any\nother color it draws the text with a shadow (`TTextContext::DrawTextOutlined`,\n`0x075D54`), in the highlight color for a keyword and with a black\nshadow."
   }
  ]
 },
 "TTextContext": {
  "opening": "A text laid out in lines for drawing from the game's markup, such as the text\nof a conversation, a message or a scripted window. The object has the width at\n`+0`, the first `TStyleRun` at `+4` and at `+8` one block with every run's\ncharacters. A run whose x is 0 starts a line.",
  "routines": [
   {
    "name": "TTextContext::TTextContext",
    "entry": 482712,
    "text": "Lays out a text. Its arguments are the text and its length, the width in\npixels, a base text style and a word of flags. It reads the markup into runs as\nfollows.\n\n- A carriage return or a line feed starts a new line (`0x075E40` to\n  `0x075E98`).\n- An `@` makes the next word a keyword, a highlighted run (`0x075EA4` to\n  `0x075EE8`), until the first character that is not a letter. That character\n  starts a plain run, and a byte at its `+7` records that the word goes on\n  when the character is not a space, a line break or 0 (`0x075EF8` to\n  `0x075FBC`).\n- A `<` followed by a digit d switches to text style base + 5 + 3 × d, a `<`\n  with no digit to base + 8 (`0x075FCC` to `0x076064`), and a `>` back to base\n  + 5 (`0x076074` to `0x0760B8`).\n- An `&` followed by a digit n, or none for 1, opens a section, and the next `&`\n  closes it (`0x0760C0` to `0x076188`). The section shows when bit n of the\n  flags is 1 and hides otherwise (`0x07611C` to `0x07616C`). Text outside any\n  section shows unless bit 0 is 1 (`0x075E08` to `0x075E2C`). The closing `&`\n  hides the text after it when bit 0 is 1 (`0x076174` to `0x076184`) and\n  otherwise leaves it as the section was, so after a hidden section the text\n  stays hidden until a section that shows. Every call but one passes flags\n  of 0, so in those an `&` hides the rest of the text. In a run of the game\n  the book Aloiphos B stops after \"lapis lazuli\" of \"lapis lazuli & jasper\",\n  and Eurybates's \"I'm the cook & hunter for the camp.\" after \"I'm the cook\".\n\nIt then measures each run (`TextWidth`, `0x0761EC`), copies every run's\ncharacters into one block (`NewPtr`, `BlockMoveData`, `0x076234` to\n`0x076270`) and breaks the runs into lines no wider than the width\n(`StyledLineBreak`, `0x07633C`). A keyword whose word goes on into the next run\nbreaks with that run as one piece (`0x0762FC` to `0x076318`). A run that\nbreaks inside splits into two (`0x076448` to `0x0764C8`), with its trailing\nspaces trimmed (`VisibleLength`, `0x0764A4`). A run that would break at its\nfirst character moves whole to the next line (`0x076428` to `0x076438`)."
   },
   {
    "name": "TTextContext::NumLines",
    "entry": 484652,
    "text": "Returns the number of lines, the runs that start a line and are not empty\n(`0x076568` to `0x076580`), and 0 for a text with one empty run."
   },
   {
    "name": "TTextContext::Draw",
    "entry": 484816,
    "text": "Draws the text from a point, a line height apart, and returns the y one line\nbelow the last (`0x0766A8`). At each run that starts a line it adds the widths\nof the line's runs (`0x076628` to `0x076650`), justifies the line (`Justify`,\n`0x076660`) and moves down a line. It draws each run (`TStyleRun::Draw`,\n`0x076684`) in the text and highlight colors given."
   },
   {
    "name": "TTextContext::Justify",
    "entry": 485096,
    "text": "Returns a line's starting x for a justification, the x given for 0 (left), the\nx less half the line's width for 1 (centered, `0x076710` to `0x07671C`), and\nthe x less the whole width for -1 (right, `0x076724`). Any other value gives\nthe x unchanged (`0x0766FC`, `0x076704`)."
   },
   {
    "name": "TTextContext::DrawTextOutlined",
    "entry": 485212,
    "text": "Draws text with a shadow, in the shadow color one pixel down and to the right\n(`0x0767E4` to `0x076800`) and then in the text color at the point (`0x076840`\nto `0x07685C`), and then sets the text color back to black. A color from 0 up is a QuickDraw color\nconstant (`ForeColor`). One below 0 is an entry of the game's color table\n(`RGBForeColor`, entry -n of the table at toc -30216). When the text and the\nshadow are both black (33, or -255) the shadow becomes white, 30 (`0x076768`\nto `0x0767A4`)."
   },
   {
    "name": "TTextContext::~TTextContext",
    "entry": 485564,
    "text": "Frees every run (`0x0768E8` to `0x0768F8`), disposes of the characters' block (`DisposePtr`, `0x076908`) and frees the object when the flag is above 0."
   }
  ]
 },
 "TBufferGWorld": {
  "opening": "An offscreen drawing buffer that lives on the stack. Its constructor, which the\ncompiler builds inline at each place that makes the object, saves the current port and\ndevice at `+4` and `+8`, stores the offscreen `GWorld` at `+12` and sets it as\nthe port for drawing. The destructor copies the result to the saved port.",
  "routines": [
   {
    "name": "TBufferGWorld::~TBufferGWorld",
    "entry": 238272,
    "text": "Sets the saved port back (`SetGWorld`, `0x03A2E4`), reads the port's rectangle\nand widens it by the rectangle's left and top coordinates (`InsetRect` with\nboth negated, `0x03A318`), copies the offscreen picture into the port over that\nrectangle (`CopyBits`, `0x03A348`),\nand frees the object when the flag is above 0."
   }
  ]
 },
 "THood": {
  "opening": "The neighborhood, the list of things near the party that the game draws and\nupdates, from the current zone's list of things. The object has a byte at `+0`\nthat is 1 when the neighborhood is every thing in the zone, the center square\nat `+2` and `+4`, the count at `+6` and from `+8` the things' numbers, two bytes\neach, up to 2,048 (`THood::AddToHood`, `0x06C9E0`), or 16,384 with grimoire's\n`hood-size` fix.\n\nIn a zone of fewer than 1,536 things the neighborhood is all of them\n(`THood::ResetHood`, `0x06C7C4`), and a move never rebuilds it. In a larger\nzone it is the things within 32 squares of its center (`0x06C890` to\n`0x06C8DC`), and a move of more than 16 squares from the center rebuilds it\n(`THood::MoveHood`, `0x06C6A8` to `0x06C6F0`).",
  "routines": [
   {
    "name": "THood::THood",
    "entry": 443964,
    "text": "Makes an empty neighborhood centered off the map, at (-100, -100) (`0x06C63C` to `0x06C654`)."
   },
   {
    "name": "THood::MoveHood",
    "entry": 444032,
    "text": "Rebuilds the neighborhood around a square (`ResetHood`, `0x06C70C`) when the\nsquare is more than 16 from the center on either axis (`0x06C6A8` to\n`0x06C6F0`) and the neighborhood is not every thing in the zone."
   },
   {
    "name": "THood::ForceReset",
    "entry": 444248,
    "text": "Moves the center off the map and sets the byte at `+0` to 0, so that the next `MoveHood` rebuilds (`0x06C758` to `0x06C768`)."
   },
   {
    "name": "THood::ResetHood",
    "entry": 444312,
    "text": "Rebuilds the neighborhood around a square. It sets the byte at `+0` to 1 when\nthe zone has fewer than 1,536 things (`0x06C7C0` to `0x06C7DC`), and goes\nthrough the zone's things from 1, records of 16 bytes (`0x06C7FC`). It considers\na thing whose first byte, less 0x80, is 0 to 4, 0x20 to 0x24, 0x42 or 0x44\n(`0x06C804` to `0x06C848`). It always adds a count-down egg, first byte 0x42\nand kind 10 (`0x06C870` to `0x06C880`). In a large zone, for a thing more than\n32 squares from the center (`0x06C890` to `0x06C8DC`) it re-arms an egg whose\nfirst byte is 0xC2 to 0x42 (`0x06C8E4` to `0x06C8F0`), deletes a thing whose\nfirst byte has 0x20 (`DeleteProp`, `0x06C904`), and leaves the thing out. It\nthrows \"Too many objects in the neighborhood\" once the count reaches 2,048\n(`0x06C92C` to `0x06C948`)."
   },
   {
    "name": "THood::AddToHood",
    "entry": 444836,
    "text": "Adds a thing's number to the neighborhood (`0x06C9D8`), throws when the count\nreaches 2,048 (`0x06C9DC` to `0x06C9FC`), and at 1,536 or more sets the byte at\n`+0` to 0 so that the next move rebuilds (`ForceReset`, `0x06CA04` to\n`0x06CA28`)."
   },
   {
    "name": "THood::RemoveFromHood",
    "entry": 445032,
    "text": "Removes a thing's number, moving the last entry into its place (`0x06CA74` to `0x06CAC0`)."
   }
  ]
 },
 "TPathFinder": {
  "opening": "The search a character uses to find its way, one object at toc -30412. It works\nin a window of 31 by 31 squares centered on the view's center (the view object\nat toc -30408, x at `+8` and y at `+10`), with a byte for each square from\n`+0`. Before a search each byte is 8, for not reached\n(`TPathFinder::ResetPaths`, `0x05A254` to `0x05A260`). The start's byte is 255,\na step found blocked is -2, and any other value is the direction the search\nreached the square in. The open list has up to 100 squares of 12 bytes from\n`+964` (x, y, weight and the next square), with its head at `+2164`, its free\nlist at `+2168`, the closest square found at `+2172`, the number of squares in\nuse at `+2176`, the goal at `+2178` and `+2180`, the start at `+2182` and\n`+2184`, and the mover's attributes for `TGameSys::TryMove` at `+2188`.\n\nA direction is a number from 0 to 7, clockwise from north, with 0 north, 1\nnorth-east, 2 east, 3 south-east, 4 south, 5 south-west, 6 west and 7\nnorth-west. A step in a direction moves x by 1 for 1 to 3 and by -1 for 5 to 7,\nand y by -1 for 7, 0 and 1 and by 1 for 3 to 5 (`TPathFinder::CanSimpleNavigate`,\n`0x05A6A8` to `0x05A718`).",
  "routines": [
   {
    "name": "TPathFinder::ResetPaths",
    "entry": 369220,
    "text": "Sets every square of the window to 8, for not reached, and empties the open list (`0x05A254` to `0x05A284`)."
   },
   {
    "name": "TPathFinder::CalcWeight",
    "entry": 369356,
    "text": "Returns a square's Manhattan distance to the goal, the difference in x plus the difference in y (`0x05A2D8` to `0x05A2FC`)."
   },
   {
    "name": "TPathFinder::AddCandidate",
    "entry": 369468,
    "text": "Adds a square to the open list, kept in order of weight from the smallest\n(`0x05A3B4` to `0x05A41C`), ahead of any square of equal weight. The square comes\nfrom the free list (`0x05A358` to `0x05A368`) or else the next of the\n100 (`0x05A370` to `0x05A394`). Once all 100 are in use and none is free, the\nsquare is not added (`0x05A374`)."
   },
   {
    "name": "TPathFinder::AddNegCandidate",
    "entry": 369768,
    "text": "Adds a square to the open list in order of weight from the largest, for `FurthestPoint` (`0x05A4E0` to `0x05A548`)."
   },
   {
    "name": "TPathFinder::NextCandidate",
    "entry": 370068,
    "text": "Removes and returns the first square of the open list, or 0 (`0x05A598` to `0x05A5B8`)."
   },
   {
    "name": "TPathFinder::FreeCandidate",
    "entry": 370168,
    "text": "Puts a square on the free list (`0x05A5F8` to `0x05A600`)."
   },
   {
    "name": "TPathFinder::CanSimpleNavigate",
    "entry": 370264,
    "text": "Returns 1 when a straight walk from one square to another succeeds. It steps one\nsquare at a time in the direction from where it is to the goal\n(`FindDirection`, `0x05A69C`) and tries each step with `TGameSys::TryMove` and\nthe attributes given (`0x05A73C`), and returns 0 at the first step that\nfails."
   },
   {
    "name": "TPathFinder::FindWaypoint",
    "entry": 370632,
    "text": "Finds a path (`FindPath`, `0x05A80C`) and, when the search found one, the\nfurthest square along it that a straight walk reaches (`FindFirstWaypoint`,\n`0x05A838`), written back through the two pointers. It returns `FindPath`'s\nresult."
   },
   {
    "name": "TPathFinder::FindFirstStep",
    "entry": 370848,
    "text": "Writes back through the two pointers the first step from the start toward the\nclosest square found. It walks back from that square, by the direction in each\nsquare's byte, until it meets the start's 255 (`0x05A8F4` to `0x05A9B0`), and\nthe step it last walked back, turned round, is the answer (`0x05A9B4` to\n`0x05A9C0`). The loop never ends. It reads each byte sign-extended (`extsb`,\n`0x05A9A8`) and compares it with 255 (`0x05A9AC`), which a sign-extended byte\nnever equals, so at the start it walks on. The program's one call, in\n`TActiveMonster::DoMove`, is for behavior 17, which nothing in the shipped game\nsets. Grimoire's `walk-to` fix met the hang when played and compares with -1\ninstead. After `FindPath` returns 0 for a start that is the goal, `+2172` is\nstill 0 from `ResetPaths`, and the walk starts from address 0."
   },
   {
    "name": "TPathFinder::FindFirstWaypoint",
    "entry": 371200,
    "text": "Walks back from the closest square found toward the start and writes back\nthrough the two pointers the first square on the way that a straight walk from\nthe start reaches (`CanSimpleNavigate`, `0x05AA84`). The walk ends at the\nstart at the latest, since a straight walk from the start to itself succeeds.\nA test for a step back onto a square marked -2 calls `DebugStr` with \"Back step\ninto wall!\" (`0x05AB54` to `0x05AB60`). The test compares the sign-extended\nbyte with 254, which never matches, so the message never shows. Found reading,\nnot shown in a run."
   },
   {
    "name": "TPathFinder::FindPath",
    "entry": 371656,
    "text": "Looks for a way from a square to a goal for a mover. It returns 32767 at once\nwhen the start is more than 15 squares from the view's center on either axis\n(`0x05AC14` to `0x05AC58`), and 0 when the start is the goal (`0x05ACC4` to\n`0x05ACD4`). The attributes for the moves are the mover's with 0x08000000\nadded (`GetMonstAttrs`, `0x05ACE8`), or 0x88000004 with no mover\n(`0x05ACFC`). It is a best-first search by distance to the goal. It always\nexpands the open square nearest the goal and tries the eight steps from it\ninside the window (`0x05AD40` to `0x05AF08`). A step onto a square not\nreached that `TGameSys::TryMove` allows marks the square with its direction\nand opens it (`0x05AEB0` to `0x05AED8`). A blocked orthogonal step marks the\nsquare -2, and a blocked diagonal leaves it for another way (`0x05AEE0` to\n`0x05AEFC`). The search stops at the goal (`0x05AD10` to `0x05AD20`), when the\nopen list is empty, or at the first square that opens nothing once the search\nhas expanded a square 1 from the goal (`0x05AD24` to `0x05AD30`, `0x05AF0C` to\n`0x05AF20`), since the search sets its record of that square once and never\nclears it.\nThe closest square it reached is at `+2172`. It returns 32767 when the closest square is the start (`0x05AF84` to\n`0x05AFAC`), and otherwise that square's distance from the goal."
   },
   {
    "name": "TPathFinder::FurthestPoint",
    "entry": 372752,
    "text": "Looks for the reachable square furthest from a point, for a mover running away,\nwith the attributes given and 0x08000000 added (`0x05B0B8`). The search\nexpands the square furthest from the point first (`AddNegCandidate`), only\ntwo squares or more in from the window's edges (`0x05B1F8` to `0x05B288`), and\nstops at the first square at the edge of the area the view shows (`0x05B0D4`\nto `0x05B164`). It writes the furthest square it reached back through the two\npointers (`0x05B3B8` to `0x05B3CC`)."
   },
   {
    "name": "TPathFinder::FindDirection",
    "entry": 373788,
    "text": "Returns the direction of a step (dx, dy) from the ratio 1000 × dx / dy, with\nboundaries at ±410 and ±2,420 (`0x05B440` to `0x05B4D8`), about 22.5 and 67.5\ndegrees. A step with dy of 0 is east when dx is above 0 and west otherwise,\n(0, 0) among them (`0x05B41C` to `0x05B438`)."
   }
  ]
 },
 "THeap": {
  "opening": "The store of the game's persistent objects, the lists, strings and tables that\nscripts make, which a save includes. The program makes one heap at startup,\nwith 4,096 references and 262,144 bytes (`CreateGlobals`), and the global at toc\n-30284 points at it. The object has the heap's memory at `+0`, a table of chunk\naddresses by reference number at `+4`, the number of references at `+8` (a\nshort) and the heap's size in bytes at `+12` (`THeap::InitHeap`, `0x0AB358` to\n`0x0AB380`). Beside it the heap allocates a second block once, 8,192 bytes at\nthe address in the global at toc -30428 (`0x0AB3D0`), 4,096 halfwords with the\nreference number of each thing's table (`PropItem::AllocateFrame`). A save has\nthe heap as resource `0xF307` and the second block as `0xF308` (`THeap::Save`,\n`0x0AB850` and `0x0AB880`).\n\nThe heap is a run of chunks, each an 8-byte header and its data. The header\nhas the data's size at `+0`, the reference number at `+4` and, in the byte at\n`+6`, a bit 0x80, a type in bits 0x70 (0 for a free chunk), a bit 0x08 that\nmeans the chunk has 4 bytes more than its size rounded up to 4\n(`THeap::DataChunkSize`, `0x0AC06C` to `0x0AC088`), a bit 0x04, and with the\nbyte at `+7` a 10-bit count (`THeap::Free`, `0x0AB4C0` to `0x0AB508`). A chunk's\ndata is its size rounded up to 4, plus the 4 bytes when bit 0x08 is 1, and the\nnext chunk follows it (`THeap::Next`). Nothing collects garbage\n(`THeap::PerformGC` is empty). An object goes when its count of references\nfalls to 0 (`THeapObj::DecRef`).",
  "routines": [
   {
    "name": "THeap::InitHeap",
    "entry": 701228,
    "text": "Makes an empty heap of a number of references and a size. It allocates the\nmemory and a cleared table (`NewPtrClear`, `0x0AB364`, `0x0AB378`) and makes the\nwhole heap one free chunk (`0x0AB3BC`). It allocates the 8,192-byte block the\nfirst time (`0x0AB3D0`). No memory throws \"Can't allocate persistant storage\nheap\" [sic] or \"Can't allocate unique object storage map\"."
   },
   {
    "name": "THeap::GetHeader",
    "entry": 701520,
    "text": "Returns the chunk of a reference number, from the table (`0x0AB454`, `0x0AB458`)."
   },
   {
    "name": "THeap::Free",
    "entry": 701576,
    "text": "Frees a chunk. It clears the chunk's entry in the table (`0x0AB4B8`), makes it a\nfree chunk of its whole size with its reference and count at 0 (`0x0AB4C0` to\n`0x0AB508`), and joins each free chunk that follows to it (`0x0AB51C` to\n`0x0AB554`). It releases none of the objects in the chunk's data."
   },
   {
    "name": "THeap::Allocate",
    "entry": 701860,
    "text": "Allocates a chunk of a size for a reference number and a type\n(`THeap::Allocate` at `0x0ABCF4`, called at `0x0AB5D0`), and enters it in the\ntable under the number (`0x0AB5E8`)."
   },
   {
    "name": "THeap::Resize",
    "entry": 702036,
    "text": "Changes a chunk's size and returns the chunk, which can be a new one. A size\nno larger than the chunk's present space stays in place. When at least 8 bytes\nremain over, they become a free chunk after it (`0x0AB694` to `0x0AB710`).\nOtherwise it sets bit 0x08 when 4 to 7 bytes remain over (`0x0AB718` to\n`0x0AB730`). It leaves a bit 0x08 already at 1 as it is when 0 to 3 remain\nover, so the chunk's space then counts 4 bytes more than it has, and the heap\nlooks for the next chunk 4 bytes too far on (`0x0AB720`, `DataChunkSize`).\nFound reading, not shown in a run. A larger size allocates a new chunk\n(`0x0AB748`), points the table at it, copies the data, the reference and the\nflags (`0x0AB768` to `0x0AB7CC`) and frees the old one (`0x0AB7D4`). It reads\nthe old chunk's address before the allocation and uses it after, and the\nallocation can move every chunk in use (`Allocate` at `0x0ABCF4`). After a move\nthe copy and the free act on whatever chunk then sits at the old address. A\ngrow reaches this only when no free run fits but the free space in total does.\nFound reading, not shown in a run."
   },
   {
    "name": "THeap::Save",
    "entry": 702496,
    "text": "Writes the heap to an archive as resource `0xF307` and the 8,192-byte block as\n`0xF308` (`TSegFile::SaveSegment`, `0x0AB850`, `0x0AB880`), then the table of\ncontents when it has changed, and otherwise flushes the file."
   },
   {
    "name": "THeap::Load",
    "entry": 702716,
    "text": "Reads the heap from an archive, looking into the archive's table of contents\nfor page `0xF3` directly (`+980` of the `TSegFile`, `0x0AB914`). When resource\n`0xF307` is there, it reads a stored heap shorter than this one and makes the\nrest one free chunk (`0x0AB96C` to `0x0AB9F0`), reads one of the same size\nwhole (`0x0ABA14`), and throws \"Reducing Heap Size Not Implemented\" for a longer\none (`0x0ABA34`), so a save from a larger heap fails to load. Then it rebuilds\nthe table (`RebuildTOC`, `0x0ABA40`). When `0xF308` is there it reads it into\nthe 8,192-byte block (`0x0ABA88`), whatever its length."
   },
   {
    "name": "THeap::NewRef",
    "entry": 703184,
    "text": "Returns the first reference number from 1 up whose table entry is empty, and\nthrows \"Out of persistant storage objects\" [sic] when every one is in use\n(`0x0ABAF0` to `0x0ABB38`)."
   },
   {
    "name": "THeap::SimpleAllocate",
    "entry": 703360,
    "text": "Looks for a free run of chunks big enough for a size, first fit from the\nstart. It joins free chunks next to each other as it goes (`0x0ABBD8` to\n`0x0ABBF4`), cuts the first run big enough to the size (`Resize`, `0x0ABC30`)\nand returns it. It adds the space of each run too small to the total through\nits third argument (`0x0ABC38` to `0x0ABC60`) and returns 0 when none fits."
   },
   {
    "name": "THeap::PerformGC",
    "entry": 703688,
    "text": "Does nothing (4 bytes, a return)."
   },
   {
    "name": "THeap::Allocate",
    "entry": 703732,
    "text": "Allocates a chunk of a size, first from the free space as it is\n(`SimpleAllocate`, `0x0ABD28`). When nothing fits and the free space in total\nis too small, it calls `PerformGC`, which does nothing, tries again and throws\n\"Out of persistant storage space\" [sic] (`0x0ABD90`). When the free space is\nenough but in pieces, it moves every chunk in use down to the start of the\nheap, pointing the table at each (`0x0ABD98` to `0x0ABE2C`), and cuts the\nchunk from the free space left at the end (`0x0ABE70` to `0x0ABF14`). It\nthrows when even that is too small (`0x0ABE68`)."
   },
   {
    "name": "THeap::RebuildTOC",
    "entry": 704340,
    "text": "Rebuilds the table of chunks by reference number from the heap's chunks. At\nthe first chunk that is larger than the heap, has a type above 3, or has a\nreference number above the count, it stops and makes a free chunk of the rest\nof the heap (`0x0ABF80` to `0x0ABFD8`). It enters each chunk in use with a\nreference number in the table (`0x0ABFE0` to `0x0AC004`). A reference number\nequal to the count passes the test (`0x0ABFA8`), and the table entry for it\nlands one past the table's end."
   },
   {
    "name": "THeap::DataChunkSize",
    "entry": 704612,
    "text": "Returns a chunk's space for data, its size rounded up to 4 plus 4 when bit 0x08 is 1 (`0x0AC06C` to `0x0AC088`)."
   },
   {
    "name": "THeap::Next",
    "entry": 704712,
    "text": "Returns the chunk after one, at the header plus 8 plus the data's space, or 0 at the heap's end (`0x0AC0F4` to `0x0AC10C`)."
   },
   {
    "name": "THeap::RecoverHeader",
    "entry": 704868,
    "text": "Returns the chunk's header from the address of its data, 8 bytes before (`0x0AC16C`)."
   }
  ]
 },
 "THeapList": {
  "opening": "A list in the persistent heap, the data of a chunk of type 1. It has the length\nat `+0`, the room at `+2` (both shorts) and from `+4` the items, one value word\neach (`THeapList::THeapList`, `0x0A9DFC`, `0x0A9E18`).",
  "routines": [
   {
    "name": "THeapList::Allocate",
    "entry": 695516,
    "text": "Allocates a list of a length for a reference number, a chunk of type 1 (`THeap::Allocate`, `0x0A9D14`), and makes the list in it."
   },
   {
    "name": "THeapList::CalcSize",
    "entry": 695676,
    "text": "Returns the bytes a list of a length needs, 4 plus 4 for each item, with room for at least 4 (`0x0A9D80` to `0x0A9D98`)."
   },
   {
    "name": "THeapList::THeapList",
    "entry": 695756,
    "text": "Makes a list of a length, storing the length at `+0` (`0x0A9DFC`), with room for\nthe length and at least 4 (`0x0A9E18`), every item None (`0x0A9E3C` to\n`0x0A9E60`)."
   },
   {
    "name": "THeapList::~THeapList",
    "entry": 695984,
    "text": "Releases every item (`VAddr::DecRef`, `0x0A9EE8`) and frees the object when the flag is above 0."
   },
   {
    "name": "THeapList::Length",
    "entry": 696156,
    "text": "Returns the length."
   },
   {
    "name": "THeapList::GetItem",
    "entry": 696204,
    "text": "Returns the item at an index, or None for an index below 0 or not below the length (`0x0A9F8C` to `0x0A9FC4`)."
   },
   {
    "name": "THeapList::SetItem",
    "entry": 696308,
    "text": "Stores a value at an index from 0 below the length, counting a reference to it\nand releasing the old item (`0x0AA04C`, `0x0AA060`). An index outside does\nnothing, and so does the same value again."
   },
   {
    "name": "THeapList::Append",
    "entry": 696512,
    "text": "Adds a value at the end, counting a reference to it (`0x0AA140`). A full list\nfirst doubles its room and grows its chunk (`THeap::Resize`, `0x0AA0F4` to\n`0x0AA120`), which can move it, and then the value goes on the end of the list\nat its new place (`0x0AA134`)."
   }
  ]
 },
 "THeapDict": {
  "opening": "A table from numbers to values in the persistent heap, the data of a chunk of\ntype 2. It has the count at `+0`, the table's size at `+2` and from `+4` the\nentries, 8 bytes each, a key (a short) and a value. An empty entry has as its\nvalue `0x5000FFFE`, the word in the global at toc -29280 (`THeapDict::THeapDict`,\n`0x0AA3E0`), which the program's start-up code sets beside None (`0x5000FFFF`),\nTrue (`0x50000001`) and False (`0x50000000`) (`__sinit_THeap_cp`), so a table\ncan have None as a value. Nothing removes an entry. The sizes are primes from a\nlist at toc +11896, 3, 7, 13, 31, 61, 127, 251, 509, 1021, 2017, 4093, 5987,\n9551, 15683, 19609 and 31397 (`THeapDict::BestSize`, `0x0AA268`).",
  "routines": [
   {
    "name": "THeapDict::Allocate",
    "entry": 696744,
    "text": "Allocates a table for a number of entries and a reference number, a chunk of\ntype 2 (`THeap::Allocate`, `0x0AA1E8`), and makes the table in it at the size\n`BestSize` gives (`0x0AA1FC`)."
   },
   {
    "name": "THeapDict::BestSize",
    "entry": 696928,
    "text": "Returns the first size in the list above twice a number (`0x0AA280` to `0x0AA28C`), and throws \"HeapDict overflow\" past the last (`0x0AA2BC`)."
   },
   {
    "name": "THeapDict::CalcSize",
    "entry": 697096,
    "text": "Returns the bytes a table for a number of entries needs, 4 plus 8 for each entry of its size (`0x0AA31C` to `0x0AA330`)."
   },
   {
    "name": "THeapDict::THeapDict",
    "entry": 697196,
    "text": "Makes an empty table of a size, every entry with key 0 and the empty value (`0x0AA3C4` to `0x0AA3FC`)."
   },
   {
    "name": "THeapDict::~THeapDict",
    "entry": 697484,
    "text": "Releases every value that is not empty (`VAddr::DecRef`, `0x0AA4E8`) and frees the object when the flag is above 0."
   },
   {
    "name": "THeapDict::lookup",
    "entry": 697696,
    "text": "Returns the entry for a key, or 0 when there is none. It starts at the key\nmodulo the size and steps by a second number from the key, the key times 3\nplus 1, repeated until it is not a multiple of the size, modulo the size\n(`0x0AA584` to `0x0AA5A4`), until it finds the key or an empty entry\n(`0x0AA5A8` to `0x0AA604`)."
   },
   {
    "name": "THeapDict::insert",
    "entry": 697912,
    "text": "Stores a value under a key, searching as `lookup` does. It writes the key and\nthe value into an empty entry and adds 1 to the count (`0x0AA6B4` to\n`0x0AA6C8`). In an entry with the key it releases the old value and stores the\nnew one (`0x0AA6E4`). It counts no reference to the value."
   },
   {
    "name": "THeapDict::resize",
    "entry": 698204,
    "text": "Makes a larger table and returns it. It allocates the new table under the same\nreference number (`0x0AA788`, `0x0AA78C`) for `BestSize` of `BestSize` of the\ncount, so the new size is the first above twice the first above twice the\ncount. It inserts every entry into the new table (`0x0AA79C` to `0x0AA7E4`)\nand frees the old chunk (`0x0AA7FC`)."
   },
   {
    "name": "THeapDict::GetItem",
    "entry": 698436,
    "text": "Returns the value under a key, or None (`0x0AA86C` to `0x0AA88C`)."
   },
   {
    "name": "THeapDict::SetItem",
    "entry": 698576,
    "text": "Stores a value under a key, counting a reference to it (`0x0AA8F8`). When the\ncount times 3 is at least the size times 2, it first makes the table larger\n(`resize`, `0x0AA918`) and stores the value in the new one."
   }
  ]
 },
 "THeapObj": {
  "opening": "A reference to an object in the persistent heap, a 2-byte reference number,\nwhich a value word of type 7 has in its low half. The object's type is the\nchunk's type, 1 a list (`THeapList`), 2 a table (`THeapDict`), 3 a string, the\ncharacters and a zero byte. Its count of references is the chunk header's\n10-bit count (`THeap`).",
  "routines": [
   {
    "name": "THeapObj::IncRef",
    "entry": 698760,
    "text": "Adds 1 to the object's count (`0x0AA9C0` to `0x0AA9CC`). The count is 10 bits,\nso 1,023 references and one more give 0."
   },
   {
    "name": "THeapObj::DecRef",
    "entry": 698892,
    "text": "Subtracts 1 from the object's count (`0x0AAAA0` to `0x0AAAB4`), or, when the count is\n1 or 0, frees the object (`0x0AAA44`), first releasing a list's items or a\ntable's values (`0x0AAA74`, `0x0AAA84`) and then the chunk (`THeap::Free`,\n`0x0AAA94`)."
   },
   {
    "name": "THeapObj::GetType",
    "entry": 699124,
    "text": "Returns the object's type (`0x0AAB2C`)."
   },
   {
    "name": "THeapObj::At",
    "entry": 699228,
    "text": "Returns the item at an index of a list (`THeapList::GetItem`, `0x0AABD8`), the\nvalue under a key of a table (`THeapDict::GetItem`, `0x0AABEC`), or a string's\nbyte at an index below the chunk's size as a number, read signed\n(`0x0AABF4` to `0x0AAC18`). The index can be the string's zero byte. Any\nother gives None."
   },
   {
    "name": "THeapObj::AtPut",
    "entry": 699520,
    "text": "Stores a value at an index of a list (`THeapList::SetItem`, `0x0AACF4`) or under\na key of a table (`THeapDict::SetItem`, `0x0AAD08`), or a number's low byte at\nan index of a string below the chunk's size (`0x0AAD10` to `0x0AAD44`), which\ncan be the zero byte at its end."
   },
   {
    "name": "THeapObj::Append",
    "entry": 699788,
    "text": "Adds a value at the end of a list (`THeapList::Append`, `0x0AADD8`). It does nothing for any other type."
   },
   {
    "name": "THeapObj::Length",
    "entry": 699932,
    "text": "Returns a list's length (`0x0AAE7C`), a string's chunk size less 1\n(`0x0AAE84`), 32,767 for a table (`0x0AAE90`), and 0 for any other."
   },
   {
    "name": "THeapObj::THeapObj",
    "entry": 700120,
    "text": "Makes an object of a type, with a size or length and a reference number, a new\none (`THeap::NewRef`, `0x0AAF0C`) when the number given is 0. Their classes make\na list and a table (`0x0AAF48`, `0x0AAF58`). A string is a chunk of type 3 of\nthe size with a zero first byte (`0x0AAF70`, `0x0AAF7C`), and any other type an\nempty chunk (`0x0AAF94`). Its count starts at 0."
   },
   {
    "name": "THeapObj::GetString",
    "entry": 700392,
    "text": "Returns the address of the object's data, a string's characters (`0x0AB014`)."
   },
   {
    "name": "THeapObj::ResizeString",
    "entry": 700496,
    "text": "Changes a string's chunk to a size (`THeap::Resize`, `0x0AB0A4`). It does nothing for any other type."
   },
   {
    "name": "THeapObj::DispatchHeapObj",
    "entry": 700652,
    "text": "Runs a method of a script on an object, the `method` opcode's route for a value\nof type 7. Method 3 gives the length (`0x0AB158`), 4 the item at an index\n(`0x0AB184`), and 5 stores a value at an index and gives the object\n(`0x0AB1A4`). Method 7 adds the arguments to a list (`0x0AB1E0` to\n`0x0AB20C`), or adds their text to a string after growing the string's chunk to\nthe total (`0x0AB21C` to `0x0AB2C4`), and gives the object. A table, other\nmethods and other types give None (`0x0AB2D4`)."
   }
  ]
 },
 "VAddr": {
  "opening": "A value of the script machine, a 32-bit word. Its top 4 bits are its type, read\nsigned, so a word with the top bit set is type -1, a far address, a resource\nnumber in bits 16 to 30 and an offset in the low 16 (`VAddr::VAddr`,\n`0x0077F8` to `0x007808`). Type 0 is a number of 28 bits. Type 5 is None, True\nand False, `0x5000FFFF`, `0x50000001` and `0x50000000`. Type 4 is a game object,\nwith bit 24 at 1 for a system object (`VAddr::DecRef`, `0x0A9B98`). Type 7 is a\nheap object, its reference number in the low 16 bits.",
  "routines": [
   {
    "name": "VAddr::VAddr",
    "entry": 30700,
    "text": "Makes a value from a type and two halves, the type in the top 4 bits and the halves in the rest (`0x007810` to `0x007820`), or a far address for type -1 (`0x0077F8` to `0x007808`)."
   },
   {
    "name": "VAddr::VAddr",
    "entry": 541068,
    "text": "Makes the value 0."
   },
   {
    "name": "VAddr::DecRef",
    "entry": 695116,
    "text": "Releases a value. It deletes a system object (`DeleteSysObj`, `0x0A9BB0`) and\nlowers a heap object's count of references by 1 (`THeapObj::DecRef`,\n`0x0A9BFC`). Other values stay as they are."
   },
   {
    "name": "VAddr::IncRef",
    "entry": 695360,
    "text": "Counts a reference to a heap object (`THeapObj::IncRef`, `0x0A9C98`). It counts no other value, system objects among them."
   }
  ]
 },
 "PropItem": {
  "opening": "A thing in the game's world. The one routine here gives it a table in the\npersistent heap.",
  "routines": [
   {
    "name": "PropItem::AllocateFrame",
    "entry": 31836,
    "text": "Returns the thing's table, the heap object at `+12` when it is a table\n(`0x007C8C` to `0x007C9C`). Otherwise it makes a new table (`THeapObj::THeapObj`,\n`0x007CB4`), counts a reference to it, stores it at `+12` and, when the thing\nhas a number at `+8`, enters the table's reference number in the 8,192-byte\nblock of `THeap` at twice that number (`0x007CDC` to `0x007CF0`)."
   }
  ]
 },
 "TSegLoad": {
  "opening": "A copy of one resource of an archive in memory allocated for it, the address\nat `+0`.",
  "routines": [
   {
    "name": "TSegLoad::TSegLoad",
    "entry": 505940,
    "text": "Reads a resource of an archive whole into new memory (`NewPtr`, `0x07B8C8`,\n`TSegFile::LoadSegment`, `0x07B8EC`), its length from the archive's table\ndirectly (`0x07B888` to `0x07B8B0`). A missing resource or no memory leaves the\naddress 0."
   },
   {
    "name": "TSegLoad::~TSegLoad",
    "entry": 506168,
    "text": "Frees the memory (`DisposePtr`, `0x07B964`) and the object when the flag is above 0."
   },
   {
    "name": "TSegLoad::Loaded",
    "entry": 506304,
    "text": "Returns 1 when the read succeeded, the address not 0 (`0x07B9C0` to `0x07B9D0`)."
   },
   {
    "name": "TSegLoad::opPc",
    "entry": 506368,
    "text": "Returns the address of the copy."
   }
  ]
 },
 "TSpinCursor": {
  "opening": "The animated cursor that shows while the game is busy, from an 'acur' resource.\nThe game makes the object on the stack around the work. The counts of nesting\nand the cursor's frames are globals, so a second object made while one spins\ndoes nothing (`TSpinCursor::TSpinCursor`, `0x00F860`).",
  "routines": [
   {
    "name": "TSpinCursor::TSpinCursor",
    "entry": 63516,
    "text": "Starts the animated cursor of an 'acur' id. When the last cursor had the same\nid, it uses its frames again (`0x00F884` to `0x00F8A8`). Otherwise it releases\nthe old frames (`ResetCursor`, `0x00F8AC`) and reads the 'acur' (`GetResource`,\n`0x00F8C8`), up to 16 frames (`0x00F918` to `0x00F92C`), each a color cursor\n(`GetCCursor`, `0x00F964`), or a black-and-white one (`GetCursor`, `0x00F9C8`)\nwhen the first color one is missing (`0x00F974` to `0x00F998`). A later frame\nthat is missing stays empty. Then it shows the first frame (`Spin`,\n`0x00FA80`). With no 'acur' it shows the watch cursor (`GetCursor` of 4,\n`0x00FA90`)."
   },
   {
    "name": "TSpinCursor::Spin",
    "entry": 64228,
    "text": "Shows the next frame when 10 ticks or more have passed since the last\n(`TickCount`, `0x00FB28` to `0x00FB44`), as a color cursor or a black-and-white\none (`0x00FBCC`, `0x00FBE8`), and only while a flag of the application object\nat `+30` is 1 (`0x00FB14` to `0x00FB24`). It shows the frame it is at and then\nmoves to the next, wrapping at the number of frames (`0x00FB64` to\n`0x00FBA0`)."
   },
   {
    "name": "TSpinCursor::~TSpinCursor",
    "entry": 64568,
    "text": "Ends a nesting. When the last one ends, the frames stay in memory, marked for\nrelease if the next cursor is a different one (`0x00FC84` to `0x00FC8C`)."
   },
   {
    "name": "TSpinCursor::ResetCursor",
    "entry": 64744,
    "text": "Releases every frame and the 'acur' (`DisposeHandle`, `0x00FD58`, `0x00FD88`)."
   }
  ]
 },
 "TApWidget": {
  "opening": "The widget layer draws the windows built of controls, which in the shipped\nprogram is the Preferences window (`TApPrefWindow`). A widget is a pair of\nwords, a vtable and a control. With the Appearance Manager present the control\nis a Control Manager `ControlHandle`, and without it a `T7Widget` object.\nOne adapter at toc 16780 does the work for whichever kind is in use, and\n`TApWindow::AddAppearance` makes it on first use.",
  "routines": [
   {
    "name": "TApWidget::SetFont",
    "entry": 76,
    "text": "Sets a part's font. It reads the part's 24-byte `'font'` record\n(`ControlFontStyleRec`, through the widget's `GetData`, `0x000090`), with the flags\nfirst set to 255, then sets the flags to 0x47 and the font to the value given\n(`0x000098` to `0x0000AC`) and writes the record back (`SetData`,\n`0x0000C8`). The flags 0x47 mark the font, the face, the size and the\njustification as set. When `GetData` fails, as it does for every widget of the\nSystem 7 adapter, the record's other fields are whatever the stack held."
   },
   {
    "name": "TApWidget::SetData",
    "entry": 276,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 8), with the widget's control (`0x00015C`)."
   },
   {
    "name": "TApWidget::GetData",
    "entry": 420,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 12), with the widget's control (`0x0001F4`)."
   },
   {
    "name": "TApWidget::SetAlignment",
    "entry": 572,
    "text": "Sets a part's justification, as `SetFont` does, writing the value given at\n`+10` of the `'font'` record (`0x00029C`) with the flags 0x47."
   },
   {
    "name": "TApWidget::DisposeRoot",
    "entry": 18192,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 56), with the widget's control (`0x00473C`)."
   },
   {
    "name": "TApWidget::Activate",
    "entry": 18304,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 28), with the widget's control (`0x0047A8`)."
   },
   {
    "name": "TApWidget::Deactivate",
    "entry": 18412,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 32), with the widget's control (`0x004814`)."
   },
   {
    "name": "TApWidget::Enable",
    "entry": 18520,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 36), with the widget's control (`0x004880`)."
   },
   {
    "name": "TApWidget::Disable",
    "entry": 18624,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 40), with the widget's control (`0x0048E8`)."
   },
   {
    "name": "TApWidget::SetValue",
    "entry": 18728,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 16), with the widget's control (`0x004958`)."
   },
   {
    "name": "TApWidget::GetValue",
    "entry": 18844,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 20), with the widget's control (`0x0049C4`)."
   },
   {
    "name": "TApWidget::GetReference",
    "entry": 18952,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 24), with the widget's control (`0x004A30`)."
   },
   {
    "name": "TApWidget::Embed",
    "entry": 19064,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 44), with the widget's control (`0x004AB0`)."
   },
   {
    "name": "TApWidget::HandleWidgetClick",
    "entry": 19192,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 48), with the widget's control (`0x004B38`)."
   }
  ]
 },
 "TApWindow": {
  "opening": "A `TWindow` built of widgets. Its root widget's control is at `+16`.",
  "routines": [
   {
    "name": "TApWindow::AddAppearance",
    "entry": 15584,
    "text": "Makes the adapter on first use (`0x003CFC`). The adapter is a\n`TAppearanceAdapter` when byte 22 of the application object is 1 (`0x003D10`,\n`0x003D30` to `0x003D38`), which `TApp`'s start-up sets when `Gestalt('appr')`\nreports the Appearance Manager, and a `T7Adapter` otherwise (`0x003D58` to\n`0x003D60`). It then makes the window's root widget (`CreateRoot`, `0x003D7C`)\nand stores its control at `+16` (`0x003D88`)."
   },
   {
    "name": "TApWindow::HandleMessage",
    "entry": 15824,
    "text": "Passes a message below 0x20202020 to the application's `HandleCommand` (vtable\noffset 148, `0x003DE8` to `0x003E08`). A message of four characters, which is\n0x20202020 or more, goes no further here."
   },
   {
    "name": "TApWindow::SelfWidget",
    "entry": 15968,
    "text": "Returns the root widget, the widget vtable with the control at `+16` (`0x003E60` to `0x003E6C`)."
   },
   {
    "name": "TApWindow::~TApWindow",
    "entry": 16032,
    "text": "Disposes of the root widget (the adapter's `DisposeRoot`, `0x003EDC`), runs\n`TWindow::~TWindow` (`0x003EEC`) and frees the object when the flag is above 0."
   },
   {
    "name": "TApWindow::MouseRoutine",
    "entry": 16204,
    "text": "Finds the widget under the mouse (the adapter's `FindWidgetUnderMouse`,\n`0x003F90`) and, when there is one, tracks the click in it (`HandleWidgetClick`,\n`0x003FD4`, with -1 for the control's default action). When the click ends in\npart 11, a checkbox, it turns the value over, 1 for 0 and 0 for 1 (`0x003FF0`\nto `0x004038`). For a click that ends in any part it reads the control's\nreference number (`GetReference`, `0x004054`) and calls the window's\n`HandleMessage` with the widget, the reference number as the message and the\npart (vtable offset 132, `0x004078`)."
   },
   {
    "name": "TApWindow::DrawRoutine",
    "entry": 16592,
    "text": "Passes the call to the adapter's `DrawRoutine` with the window (`0x0040F4`)."
   },
   {
    "name": "TApWindow::ActivateRoutine",
    "entry": 16696,
    "text": "Passes the call to the adapter's `ActivateRoutine` with the window (`0x00415C`)."
   },
   {
    "name": "TApWindow::DeactivateRoutine",
    "entry": 16804,
    "text": "Passes the call to the adapter's `DeactivateRoutine` with the window (`0x0041C8`)."
   },
   {
    "name": "TApWindow::KeyRoutine",
    "entry": 16916,
    "text": "Passes the key to the adapter's `KeyRoutine` with the window (`0x004240`)."
   },
   {
    "name": "TApWindow::IdleRoutine",
    "entry": 17028,
    "text": "Passes the call to the adapter's `IdleRoutine` with the window (`0x0042A8`)."
   }
  ]
 },
 "TAppearanceAdapter": {
  "opening": "The adapter for the Appearance Manager. Each widget is a Control Manager\ncontrol, and each method makes the matching Control Manager call. A control's reference\nnumber is the message the window receives for a click in it.",
  "routines": [
   {
    "name": "TAppearanceAdapter::SetData",
    "entry": 776,
    "text": "Calls `SetControlData` with the control, the part, the tag, the size and the data (`0x00033C`)."
   },
   {
    "name": "TAppearanceAdapter::GetData",
    "entry": 908,
    "text": "Calls `GetControlData` with the control, the part, the tag, the size, the buffer and the size read (`0x0003C8`)."
   },
   {
    "name": "TAppearanceAdapter::SetValue",
    "entry": 1052,
    "text": "Calls `SetControlValue` (`0x000438`)."
   },
   {
    "name": "TAppearanceAdapter::GetValue",
    "entry": 1156,
    "text": "Returns `GetControlValue` (`0x000498`)."
   },
   {
    "name": "TAppearanceAdapter::GetReference",
    "entry": 1252,
    "text": "Returns `GetControlReference` (`0x0004F8`)."
   },
   {
    "name": "TAppearanceAdapter::Activate",
    "entry": 1352,
    "text": "Calls `ActivateControl` (`0x00055C`)."
   },
   {
    "name": "TAppearanceAdapter::Deactivate",
    "entry": 1448,
    "text": "Calls `DeactivateControl` (`0x0005BC`)."
   },
   {
    "name": "TAppearanceAdapter::Enable",
    "entry": 1548,
    "text": "Highlights the control with 0, active (`HiliteControl`, `0x00061C` to `0x000624`)."
   },
   {
    "name": "TAppearanceAdapter::Disable",
    "entry": 1648,
    "text": "Highlights the control with 255, inactive (`HiliteControl`, `0x000680` to `0x000688`)."
   },
   {
    "name": "TAppearanceAdapter::Embed",
    "entry": 1748,
    "text": "Embeds the control in the container given (`EmbedControl`, `0x0006F4`)."
   },
   {
    "name": "TAppearanceAdapter::HandleWidgetClick",
    "entry": 1864,
    "text": "Returns 0 for a control highlighted with 255 (byte 17 of its record,\n`0x000768` to `0x000778`), and otherwise the part `HandleControlClick` returns\n(`0x000790`)."
   },
   {
    "name": "TAppearanceAdapter::CreateRoot",
    "entry": 2052,
    "text": "Makes the window's root control (`CreateRootControl`, `0x00082C`) and returns it as a widget (`0x000838` to `0x000840`)."
   },
   {
    "name": "TAppearanceAdapter::DisposeRoot",
    "entry": 2204,
    "text": "Does nothing. The Window Manager disposes of the controls with the window."
   },
   {
    "name": "TAppearanceAdapter::NewTApControl",
    "entry": 2272,
    "text": "Embeds a new control in the parent widget given (the adapter's `Embed`,\n`0x000940`) and returns it as a widget (`0x000948`, `0x000950`)."
   },
   {
    "name": "TAppearanceAdapter::NewGroupBox",
    "entry": 2500,
    "text": "Makes a group box with a title, procID 160 (`NewControl`, `0x0009F8`,\n`0x000A1C`), and embeds it (`NewTApControl`, `0x000A38`)."
   },
   {
    "name": "TAppearanceAdapter::NewSlider",
    "entry": 2724,
    "text": "Makes a slider with the value, the minimum and the maximum given and procID 48\nplus the variant given (`0x000AD8`, `NewControl` at `0x000B00`), and embeds\nit."
   },
   {
    "name": "TAppearanceAdapter::NewCheckBox",
    "entry": 2952,
    "text": "Makes a checkbox, procID 1, with the value given and a range of 0 to 1 (`0x000BB8`, `0x000BBC`, `NewControl` at `0x000BE0`), and embeds it."
   },
   {
    "name": "TAppearanceAdapter::NewPushButton",
    "entry": 3176,
    "text": "Makes a push button, procID 0 (`0x000C9C`, `NewControl` at `0x000CC0`), and embeds it."
   },
   {
    "name": "TAppearanceAdapter::NewStaticIcon",
    "entry": 3400,
    "text": "Makes an icon control that does not track, procID 321, with the icon's resource number as its value\n(`0x000D78`, `0x000D88`, `NewControl` at `0x000DA0`), and embeds it."
   },
   {
    "name": "TAppearanceAdapter::NewStaticText",
    "entry": 3620,
    "text": "Makes a static text control, procID 288 (`0x000E30`, `NewControl` at\n`0x000E90`), embeds it, sets its font (`TApWidget::SetFont`, `0x000EC8`), and\nsets its `'text'` data to the Pascal string given (`0x000ED4` to `0x000EF8`)."
   },
   {
    "name": "TAppearanceAdapter::FindWidgetUnderMouse",
    "entry": 3972,
    "text": "Returns the control under a point as a widget (`FindControlUnderMouse`, `0x000FB8`), with its part written back."
   },
   {
    "name": "TAppearanceAdapter::DrawRoutine",
    "entry": 4156,
    "text": "Draws every control of the window (`DrawControls`, `0x001054`)."
   },
   {
    "name": "TAppearanceAdapter::ActivateRoutine",
    "entry": 4268,
    "text": "Activates the root control at `+16` (`ActivateControl`, `0x0010C4`)."
   },
   {
    "name": "TAppearanceAdapter::DeactivateRoutine",
    "entry": 4384,
    "text": "Deactivates the root control at `+16` (`DeactivateControl`, `0x001138`)."
   },
   {
    "name": "TAppearanceAdapter::KeyRoutine",
    "entry": 4504,
    "text": "Passes the current key to the control with the keyboard focus\n(`GetKeyboardFocus`, `0x0011BC`, then `HandleControlKey`, `0x0011F4`), with the\nkey code, the character and the modifiers of the event record at `+4` of the\napplication object (`0x0011CC` to `0x0011F0`)."
   },
   {
    "name": "TAppearanceAdapter::IdleRoutine",
    "entry": 4688,
    "text": "Gives the window's controls idle time (`IdleControls`, `0x001268`)."
   }
  ]
 },
 "T7Adapter": {
  "opening": "The adapter for System 7, with no Appearance Manager. Each widget's control is\na `T7Widget` object, and each call goes to that object's methods. Checkboxes\nand push buttons are still Control Manager controls inside a\n`T7ControlWidget`. The program draws the group box, the icon, the text and the\nslider.",
  "routines": [
   {
    "name": "T7Adapter::SetData",
    "entry": 11076,
    "text": "Calls the widget's `SetData` (`0x002B90`), and returns -30581, `errDataNotSupported`, for no widget (`0x002B6C`)."
   },
   {
    "name": "T7Adapter::GetData",
    "entry": 11280,
    "text": "Calls the widget's `GetData` (`0x002C64`), and returns -30581 for no widget (`0x002C3C`)."
   },
   {
    "name": "T7Adapter::SetValue",
    "entry": 11496,
    "text": "Calls the widget's `SetValue` (`0x002D14`) when there is one."
   },
   {
    "name": "T7Adapter::GetValue",
    "entry": 11656,
    "text": "Returns the widget's `GetValue` (`0x002DB4`), and 0 for no widget (`0x002DA0`)."
   },
   {
    "name": "T7Adapter::GetReference",
    "entry": 11820,
    "text": "Returns the reference number at `+4` of the widget (`0x002E3C`), and 0 for no widget."
   },
   {
    "name": "T7Adapter::Activate",
    "entry": 11892,
    "text": "Calls the widget's `Activate` (`0x002E98`) when there is one."
   },
   {
    "name": "T7Adapter::Deactivate",
    "entry": 12044,
    "text": "Calls the widget's `Deactivate` (`0x002F30`) when there is one."
   },
   {
    "name": "T7Adapter::Enable",
    "entry": 12200,
    "text": "Calls the widget's `Enable` (`0x002FCC`) when there is one."
   },
   {
    "name": "T7Adapter::Disable",
    "entry": 12348,
    "text": "Calls the widget's `Disable` (`0x003060`) when there is one."
   },
   {
    "name": "T7Adapter::Embed",
    "entry": 12496,
    "text": "Calls the widget's `Embed` with the parent given (`0x003104`) when there is one."
   },
   {
    "name": "T7Adapter::HandleWidgetClick",
    "entry": 12624,
    "text": "Returns the widget's `HandleWidgetClick` (`0x003194`), and 0 for no widget (`0x003174`)."
   },
   {
    "name": "T7Adapter::CreateRoot",
    "entry": 12800,
    "text": "Makes a `T7Widget` of 20 bytes with no children for the window's root (`0x00320C` to `0x00325C`) and returns it as a widget."
   },
   {
    "name": "T7Adapter::DisposeRoot",
    "entry": 12984,
    "text": "Deletes the root's `T7Widget` (its destructor with 1, `0x0032EC` to `0x0032F4`).\nThat destructor frees the root's list of children and nothing else, so every\nwidget below the root, with its color icon or slider, stays in memory after\nthe window closes. Found reading, not shown in a run."
   },
   {
    "name": "T7Adapter::NewT7Control",
    "entry": 13124,
    "text": "Wraps a Control Manager control in a new `T7ControlWidget` of 24 bytes\n(`0x00335C` to `0x003394`) and embeds it in the parent given (the adapter's\n`Embed`, `0x0033CC`)."
   },
   {
    "name": "T7Adapter::NewGroupBox",
    "entry": 13380,
    "text": "Makes a `T7GroupBox` of 284 bytes with the rectangle and the title given (`0x003460` to `0x0034A0`) and embeds it (`0x0034DC`)."
   },
   {
    "name": "T7Adapter::NewSlider",
    "entry": 13660,
    "text": "Makes a `T7SliderWidget` of 24 bytes from the arguments given (`0x003578` to `0x0035E0`) and embeds it (`0x00361C`)."
   },
   {
    "name": "T7Adapter::NewCheckBox",
    "entry": 13984,
    "text": "Makes a checkbox control, procID 1 with a range of 0 to 1 (`0x0036C4` to `0x0036DC`, `NewControl` at `0x0036F8`), and wraps it (`NewT7Control`, `0x003718`)."
   },
   {
    "name": "T7Adapter::NewPushButton",
    "entry": 14208,
    "text": "Makes a push button control, procID 0 (`0x0037B0`, `NewControl` at `0x0037D8`), and wraps it (`NewT7Control`, `0x0037F8`)."
   },
   {
    "name": "T7Adapter::NewStaticIcon",
    "entry": 14432,
    "text": "Makes a `T7IconWidget` of 32 bytes with the rectangle and the icon number given (`0x00387C` to `0x0038BC`) and embeds it (`0x0038F8`)."
   },
   {
    "name": "T7Adapter::NewStaticText",
    "entry": 14712,
    "text": "Makes a `T7LabelWidget` of 288 bytes with the rectangle and the text given\n(`0x003994` to `0x0039D4`), sets its font (`TApWidget::SetFont`, `0x0039FC`)\nand embeds it (`0x003A20`)."
   },
   {
    "name": "T7Adapter::FindWidgetUnderMouse",
    "entry": 15012,
    "text": "Returns the root widget's `FindWidgetUnderMouse` for a point (`0x003AE8`), and no widget for a window with no root (`0x003AF8` to `0x003B04`)."
   },
   {
    "name": "T7Adapter::DrawRoutine",
    "entry": 15208,
    "text": "Draws the root widget and so every widget below it (`0x003B94`)."
   },
   {
    "name": "T7Adapter::ActivateRoutine",
    "entry": 15336,
    "text": "Does nothing."
   },
   {
    "name": "T7Adapter::DeactivateRoutine",
    "entry": 15400,
    "text": "Does nothing."
   },
   {
    "name": "T7Adapter::KeyRoutine",
    "entry": 15464,
    "text": "Does nothing, so under System 7 a key reaches no control."
   },
   {
    "name": "T7Adapter::IdleRoutine",
    "entry": 15524,
    "text": "Does nothing."
   }
  ]
 },
 "T7Widget": {
  "opening": "A widget of the System 7 adapter, and the root of each window's widgets. It has\nits reference number at `+4` and a list of children from `+8`, a growable array\nwith its capacity at `+8`, its count at `+12` and its entries at `+16`. A\nmethod that a kind of widget does not need does nothing here.",
  "routines": [
   {
    "name": "T7Widget::Embed",
    "entry": 4800,
    "text": "Adds the widget to the parent's children (`0x0013AC`). A full array grows to\ntwice its capacity, or to 1 from empty (`0x0013B4` to `0x0013CC`), with its\nentries copied across and the old array freed (`0x001444` to `0x001480`). It\nthrows `length_error` (\"vector::insert length error\") past 0x3FFFFFFF entries\n(`0x001330` to `0x001374`) and `bad_alloc` when the allocation fails\n(`0x0013E4` to `0x00140C`)."
   },
   {
    "name": "T7Widget::DrawRoutine",
    "entry": 6068,
    "text": "Draws each child in order (`0x0017D4` to `0x001800`)."
   },
   {
    "name": "T7Widget::FindWidgetUnderMouse",
    "entry": 6216,
    "text": "Calls each child's `FindWidgetUnderMouse` in order and returns the first widget found (`0x001874` to `0x0018B8`), or no widget."
   },
   {
    "name": "T7Widget::HandleWidgetClick",
    "entry": 6452,
    "text": "Returns 0."
   },
   {
    "name": "T7Widget::~T7Widget",
    "entry": 6732,
    "text": "Frees the list of children (`0x001A98` to `0x001A9C`), not the children, and frees the object when the flag is above 0."
   },
   {
    "name": "T7Widget::SetData",
    "entry": 11228,
    "text": "Returns -30581, `errDataNotSupported`."
   },
   {
    "name": "T7Widget::GetData",
    "entry": 11440,
    "text": "Returns -30581, `errDataNotSupported`."
   },
   {
    "name": "T7Widget::SetValue",
    "entry": 11612,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::GetValue",
    "entry": 11772,
    "text": "Returns 0."
   },
   {
    "name": "T7Widget::Activate",
    "entry": 12000,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::Deactivate",
    "entry": 12152,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::Enable",
    "entry": 12304,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::Disable",
    "entry": 12452,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::ActivateRoutine",
    "entry": 17132,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::DeactivateRoutine",
    "entry": 17184,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::KeyRoutine",
    "entry": 17240,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::IdleRoutine",
    "entry": 17288,
    "text": "Does nothing."
   }
  ]
 },
 "T7ControlWidget": {
  "opening": "A Control Manager control as a widget of the System 7 adapter, 24 bytes, with\nthe `ControlHandle` at `+20`.",
  "routines": [
   {
    "name": "T7ControlWidget::T7ControlWidget",
    "entry": 6536,
    "text": "Stores the reference number at `+4` and the control at `+20` (`0x0019CC`, `0x0019F4`), with no children."
   },
   {
    "name": "T7ControlWidget::SetValue",
    "entry": 6928,
    "text": "Calls `SetControlValue` (`0x001B30`)."
   },
   {
    "name": "T7ControlWidget::GetValue",
    "entry": 7032,
    "text": "Returns `GetControlValue` (`0x001B90`)."
   },
   {
    "name": "T7ControlWidget::Activate",
    "entry": 7128,
    "text": "Highlights the control with 0 (`HiliteControl`, `0x001BF4`)."
   },
   {
    "name": "T7ControlWidget::Deactivate",
    "entry": 7228,
    "text": "Highlights the control with 255 (`HiliteControl`, `0x001C58`)."
   },
   {
    "name": "T7ControlWidget::Enable",
    "entry": 7332,
    "text": "Highlights the control with 0 (`HiliteControl`, `0x001CC0`)."
   },
   {
    "name": "T7ControlWidget::Disable",
    "entry": 7432,
    "text": "Highlights the control with 255 (`HiliteControl`, `0x001D24`)."
   },
   {
    "name": "T7ControlWidget::DrawRoutine",
    "entry": 7532,
    "text": "Draws the control (`Draw1Control`, `0x001D84`)."
   },
   {
    "name": "T7ControlWidget::FindWidgetUnderMouse",
    "entry": 7632,
    "text": "Returns this widget when the point is inside the control's rectangle\n(`PtInRect`, `0x001E0C`) and `FindControl` finds this control there\n(`0x001E30` to `0x001E4C`), with the part written back (`0x001E3C`)."
   },
   {
    "name": "T7ControlWidget::HandleWidgetClick",
    "entry": 7880,
    "text": "Tracks the click (`TrackControl`, `0x001EF0`) and returns the part."
   },
   {
    "name": "T7ControlWidget::~T7ControlWidget",
    "entry": 17764,
    "text": "Frees the list of children and frees the object when the flag is above 0. The control stays for the Window Manager."
   }
  ]
 },
 "T7GroupBox": {
  "opening": "A group box drawn by the program under System 7, 284 bytes, with its rectangle\nat `+20` and its title, a Pascal string, at `+28`.",
  "routines": [
   {
    "name": "T7GroupBox::T7GroupBox",
    "entry": 8028,
    "text": "Stores the reference number, the rectangle and the title (`0x001FD4` to `0x001FE0`)."
   },
   {
    "name": "T7GroupBox::DrawRoutine",
    "entry": 8244,
    "text": "Frames the rectangle with its top 16 lower (`FrameRect`, `0x002074` to\n`0x002080`), draws the title in the system font at that line, 4 in from the\nleft, over the frame (`TextMode` 0, `MoveTo`, `DrawString`, `0x002088` to\n`0x0020B0`), and draws the children (`T7Widget::DrawRoutine`, `0x0020C8`)."
   },
   {
    "name": "T7GroupBox::~T7GroupBox",
    "entry": 17552,
    "text": "Frees the list of children and frees the object when the flag is above 0."
   }
  ]
 },
 "T7IconWidget": {
  "opening": "A color icon drawn by the program under System 7, 32 bytes, with its rectangle\nat `+20` and the `CIconHandle` at `+28`.",
  "routines": [
   {
    "name": "T7IconWidget::T7IconWidget",
    "entry": 8464,
    "text": "Stores the reference number and the rectangle, and loads the `cicn` of the number given (`GetCIcon`, `0x002190`)."
   },
   {
    "name": "T7IconWidget::~T7IconWidget",
    "entry": 8680,
    "text": "Disposes of the icon (`DisposeCIcon`, `0x00221C`), frees the list of children and frees the object when the flag is above 0."
   },
   {
    "name": "T7IconWidget::DrawRoutine",
    "entry": 8908,
    "text": "Draws the icon in its rectangle (`PlotCIcon`, `0x0022E8`)."
   }
  ]
 },
 "T7LabelWidget": {
  "opening": "Static text drawn by the program under System 7, 288 bytes, with its rectangle\nat `+20`, the text, a Pascal string, at `+28`, the justification at `+284` and\nthe font at `+286`.",
  "routines": [
   {
    "name": "T7LabelWidget::T7LabelWidget",
    "entry": 9012,
    "text": "Stores the reference number, the rectangle and the text (`PLstrcpy`, `0x0023B8`), with a justification of 0 and a font of -1 (`0x0023C0` to `0x0023D0`)."
   },
   {
    "name": "T7LabelWidget::SetData",
    "entry": 9248,
    "text": "Accepts only `'font'` data (`0x002420`, `0x002428`), and returns -30581 for any\nother (`0x002464`). From the record it copies the font when the flags have 0x01\n(`0x002438` to `0x002444`) and the justification when they have 0x40\n(`0x00244C` to `0x002458`)."
   },
   {
    "name": "T7LabelWidget::DrawRoutine",
    "entry": 9380,
    "text": "Draws the text in its rectangle with `TETextBox` and the justification\n(`0x00256C`). A font of -1 draws in the system font, -2 in Geneva 10 and -3 in\nGeneva 10 bold (`0x0024DC` to `0x002554`). Any other value draws in the\napplication font, set before the test (`0x0024B4` to `0x0024D4`). After\n`TETextBox` it sets the application font, size 0 and plain text again."
   },
   {
    "name": "T7LabelWidget::~T7LabelWidget",
    "entry": 17336,
    "text": "Frees the list of children and frees the object when the flag is above 0."
   }
  ]
 },
 "T7SliderWidget": {
  "opening": "A slider drawn by the program's slider routines under System 7, 24 bytes,\nwith the slider at `+20` (`CreateSlider`).",
  "routines": [
   {
    "name": "T7SliderWidget::T7SliderWidget",
    "entry": 9696,
    "text": "Stores the reference number and makes the slider from the other arguments (`CreateSlider`, `0x00268C`)."
   },
   {
    "name": "T7SliderWidget::~T7SliderWidget",
    "entry": 9980,
    "text": "Disposes of the slider (`DisposeSlider`, `0x002730`), frees the list of children and frees the object when the flag is above 0."
   },
   {
    "name": "T7SliderWidget::SetValue",
    "entry": 10208,
    "text": "Sets the slider's value (`SetSliderValue`, `0x002800`)."
   },
   {
    "name": "T7SliderWidget::GetValue",
    "entry": 10312,
    "text": "Returns the slider's value (`GetSliderValue`, `0x002860`)."
   },
   {
    "name": "T7SliderWidget::Activate",
    "entry": 10408,
    "text": "Enables the slider (`SetSliderEnabled` with 1, `0x0028AC` to `0x0028C4`)."
   },
   {
    "name": "T7SliderWidget::Deactivate",
    "entry": 10508,
    "text": "Disables the slider (`SetSliderEnabled` with 0, `0x002910` to `0x002928`)."
   },
   {
    "name": "T7SliderWidget::DrawRoutine",
    "entry": 10612,
    "text": "Draws the slider (`DrawSlider`, `0x00298C`)."
   },
   {
    "name": "T7SliderWidget::FindWidgetUnderMouse",
    "entry": 10712,
    "text": "Returns this widget, with part 129, when the point is inside the slider's rectangle (`PtInRect`, `0x002A10`, `0x002A24`)."
   },
   {
    "name": "T7SliderWidget::HandleWidgetClick",
    "entry": 10916,
    "text": "Tracks the drag (`TrackSlider`, `0x002AC4`) and returns 129 when the value changed, and 0 otherwise."
   }
  ]
 },
 "TApPrefWindow": {
  "opening": "The Preferences window, a `TApWindow`. It has three groups, Sound, Game Control\nand Miscellaneous, and the buttons Save, Cancel and, when InputSprocket is\npresent, Set Controls.... The widgets are at fixed places in the object.\n\n| at | widget | message |\n|---|---|---|\n| `+20` | Sound Volume slider, 1 to 8 | `svol` |\n| `+28` | Mute checkbox for sound | `smut` |\n| `+36` | System Volume checkbox | `ssys` |\n| `+44` | Music Volume slider | `mvol` |\n| `+52` | Mute checkbox for music | `mmut` |\n| `+60` | Graphics Quality slider, 0 to 2 | none |\n| `+68` | Ambient Sounds checkbox | `ambs` |\n| `+76` | Live Dragging checkbox | none |\n| `+84` | Manually Place Containers checkbox | none |\n| `+92` | Use 'ZoomRects' checkbox | none |\n| `+100` | Walk around obstacles checkbox | none |\n| `+108` | Motion Filters checkbox | none |\n\nThe sound settings are 6 bytes at `+116` as the window opened and at `+122` as\nthey are now. The ambient switch is at `+0`, the music volume at `+2` and the\nsound volume at `+4`, where 0 means muted and -1 the system volume. The other\nsettings are the 4 bytes of the \"UI Prefs\" record at toc -5216.",
  "routines": [
   {
    "name": "TApPrefWindow::GetCurSettings",
    "entry": 663796,
    "text": "Reads the saved sound settings (`TPrefs::GetOrdinal`), \"Volume\" with 5 if there\nis none, \"Music\" with 8 and \"Ambient\" with 1 (`0x0A210C` to `0x0A2168`)."
   },
   {
    "name": "TApPrefWindow::AdjustSettings",
    "entry": 664032,
    "text": "Reads the sound settings from the widgets. The sound volume is the slider's\nvalue, 0 for a checked Mute and -1 for a checked System Volume (`0x0A2204` to\n`0x0A225C`). The music volume is its slider's value, or 0 for a checked music\nMute (`0x0A2260` to `0x0A2298`), and the ambient switch is the\ncheckbox (`0x0A22B0`)."
   },
   {
    "name": "TApPrefWindow::ApplySettings",
    "entry": 664356,
    "text": "Sets the game's sound volume, music volume and ambient sounds from a record\n(`TAudio::SetSoundVolume`, `SetMusicVolume`, `EnableAmbient`, `0x0A234C` to\n`0x0A2374`), each with 1 as the last argument, so that each one also writes\nits preference."
   },
   {
    "name": "TApPrefWindow::SaveSettings",
    "entry": 664552,
    "text": "Applies the current sound settings (`0x0A2410`) and writes the checkboxes into\nthe \"UI Prefs\" record. Walk around obstacles is 0x40 of its second byte\n(`0x0A242C`), Live Dragging 0x01 of its first (`0x0A244C`), Motion Filters\n0x08 of the second (`0x0A249C`), Use 'ZoomRects' 0x80 of the second\n(`0x0A24BC`) and Manually Place Containers 0x40 of the first (`0x0A24DC`). Live\nDragging is also copied to bytes 103, 104 and 105 of the application object\n(`0x0A2458` to `0x0A2484`). Graphics Quality 0 clears 0x80 and 0x02 of the\nfirst byte, 1 sets 0x80 alone and 2 sets both (`0x0A24F8` to `0x0A2584`). It\nthen saves the 4 bytes as \"UI Prefs\" (`TPrefs::SavePrefs`, `0x0A259C`)."
   },
   {
    "name": "TApPrefWindow::AddContent",
    "entry": 665076,
    "text": "Builds the window. Under the Appearance Manager it gives it the theme's\nbackground (`SetThemeWindowBackground`, `0x0A2648`). It reads the saved sound\nsettings into `+116` and copies them to `+122` (`0x0A265C` to `0x0A267C`),\nand makes the three groups with their widgets through the adapter in the\norder of the table above. The sound slider starts at the saved volume, or 5\nwhen it is not above 0 (`0x0A273C` to `0x0A2750`), with the icons 128 and 129\nbeside it (`0x0A27C0`, `0x0A2864`). Graphics Quality starts from bits 0x80 and\n0x02 of the \"UI Prefs\" record's first byte (`0x0A2E08` to `0x0A2E30`), with\nthe labels Better Performance and Better Quality. Set\nControls... appears only when `HasISSupport` returns true (`0x0A349C` to\n`0x0A34A8`)."
   },
   {
    "name": "TApPrefWindow::KeyRoutine",
    "entry": 669048,
    "text": "Turns Escape into Cancel (`canc`, `0x0A359C`, `0x0A3608` to `0x0A3634`),\nReturn and Enter into Save (`save`, `0x0A35AC` to `0x0A35FC`), and \"i\" into\nSet Controls... when InputSprocket is present (`iscf`, `0x0A35C4`, `0x0A3640`\nto `0x0A367C`). It passes every other key to the adapter (`0x0A3688` to\n`0x0A36A0`)."
   },
   {
    "name": "TApPrefWindow::HandleMessage",
    "entry": 669428,
    "text": "Acts on a widget's message. After each change to sound it reads and applies\nthe settings at once (`AdjustSettings`, `ApplySettings`), and most also play\ninterface sound 5 (`TAudio::PlayIFSound`).\n\n- `svol` unchecks and enables both Mute and System Volume (`0x0A3810` to\n  `0x0A3860`).\n- `smut` disables System Volume while Mute's value is 1 and enables it\n  otherwise (`0x0A3894` to `0x0A38D4`). `ssys` does the same to Mute\n  (`0x0A3908` to `0x0A3948`).\n- `mvol` unchecks the music's Mute (`0x0A397C` to `0x0A398C`), and `mvol`\n  and `mmut` play no sound.\n- `save` sets byte 29 of the application object to 1 and saves\n  (`SaveSettings`, `0x0A39CC` to `0x0A39E0`).\n- `canc` applies the settings the window opened with (`0x0A39E8` to\n  `0x0A39F0`) and sets byte 29 to 1.\n- `iscf` opens InputSprocket's configuration (`ConfigureIS`, `0x0A3A08`).\n- A message of 0, the reference number of every widget without a message in\n  the table, plays the sound and then goes to `TApWindow::HandleMessage`, as\n  every message not listed does (`0x0A3A14` to `0x0A3A38`)."
   },
   {
    "name": "TApPrefWindow::~TApPrefWindow",
    "entry": 671004,
    "text": "Runs `TApWindow::~TApWindow` (`0x0A3D48`) and frees the object when the flag is above 0."
   }
  ]
 },
 "TAppearanceMenu": {
  "opening": "A `TCommandMenu` with an Appearance Manager command number on each item.",
  "routines": [
   {
    "name": "TAppearanceMenu::TAppearanceMenu",
    "entry": 62728,
    "text": "Loads the menu of the number given (`GetMenu`, `0x00F538`) and, when it exists, inserts it before the menu given (`InsertMenu`, `0x00F558`)."
   },
   {
    "name": "TAppearanceMenu::GetCommand",
    "entry": 62892,
    "text": "Returns an item's command number (`GetMenuItemCommandID`, `0x00F5D0`), and 0 when the call fails (`0x00F5E8`)."
   }
  ]
 }
};
