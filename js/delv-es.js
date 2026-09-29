/* delv-es.js -- Cythera Data in Spanish: the table js/delv-translate.js
   applies. Loaded only when the Patches section is asked for Spanish, since
   it is the largest script the page has and nothing else reads it.

   HOW IT IS KEYED. Every piece of the game's text by its resource (four hex
   digits) and the FNV-1a hash of its English bytes (translateHash); `*` is
   every resource. No English is here: the builder reads it out of the
   visitor's own copy and looks each piece up. A piece not here stays
   English. The worksheet a translator works from lists each resource's
   pieces in the order the script reaches them, with the keyword lists and
   the calls that take them; it is made by a scratch script from
   dvmTextSites and the disassembly, and is not kept, since it is the game's
   text.

   THE RULES THE TEXT KEEPS (29 September 2026).
   - Castilian Spanish, and the hero is "tú" to everyone; a speaker who says
     "sir" or "ma'am" in English says "señor" or "señora" and still "tú",
     for one register throughout.
   - Names stay as the game spells them, the people's, the places' and the
     powers' (Alaric, Magpie, Omen, Cythera, Crolna, Mater Theia, the
     Magisterium); what a name means in English is translated where it is a
     title or a description: the LandKing is el Rey de la Tierra, LandKing
     Hall la Sala del Rey de la Tierra, the Metics los Metecos (the Greek
     resident foreigner, meteco, is the same word), the Houses las Casas,
     the Judges los Jueces, the Mages los Magos, the Tyrants los Tiranos, a
     Freemage un Mago Libre, the Journey el Viaje, an obol un óbolo (plural
     óbolos, which is Spanish; the game's "oboloi" is the Greek plural).
   - Magpie keeps his inverted order ("Muchos nombres Magpie tiene.").
   - The hero may be a man or a woman, and English says neither, so nothing
     that refers to the hero is gendered unless the script branches on the
     hero's sex (as it does for "sir" and "ma'am"): "Despiertas con un
     sobresalto", not "sobresaltado"; "Te doy la bienvenida", not
     "Bienvenido"; a noun's own gender ("una criatura", "otro títere") is
     not the hero's and stays.
   - The marks stay where the script wants them: `*` waits for a click,
     `@` highlights the word after it, `\n` breaks the line, and a NUL
     stays exactly where the English has one (the applier refuses
     otherwise). Dialogue keeps the game's straight double quotes, and a
     spaced hyphen where the English has one and a dash reads naturally.
   - A highlighted word has no accent, because the program's "@" scan takes
     A to Z and a to z only and would end the word at the accent; and its
     stem is added to the keyword list that answers it (`keys`), since a
     click says the highlighted word. "@lazo" for "@bond", not "@vínculo".
   - A keyword stem is cut before any accent (a byte of 0x80 up in a keyword
     list is fatal, GRIMOIRE-NOTES under grimoire/fixable-bugs-1adxav), so a
     word typed with its accent is met only when the accent comes late
     enough: "adi" answers "adiós" and "adios", "faci" answers "facil" only.
   - Only the characters Argos A Nouveau carries, with the letters this adds:
     a-z, A-Z, 0-9, space and ! " # $ & ' ( ) , - . : ; = ? and á é í ó ú ñ
     ü ¿ ¡ Á É Í Ó Ú Ñ Ü. No % (the menus' format), no *, @ or # in running
     text beyond what the English has, no curly quotes and no dashes.

   A piece that is built at run time from pieces (a part of the body put
   between "Your " and " been improved.", "wo" before "man") is translated
   so that every way the script joins them reads as Spanish; the worksheet
   shows the joins. */

const DELV_TRANSLATION_ES = {
  lang: 'es',
  name: 'Español',
  font: typeof translateSpanishGlyphs === 'function' ? translateSpanishGlyphs : null,

  // The message pane, TxSt 132 "Text", is Geneva 10, which has none of the
  // letters at the codes the script text carries them at; set in the
  // conversation face, with its new letters, it draws them.
  styles: { 132: { font: 'ArgosANouveau', size: 12 } },

  // The data file's STR# resources, by id and the hash of each English string.
  strings: {
    128: { 'd6f8a003': 'Adiós', '0fe07306': 'Nombre', '42d9307c': 'Trabajo', 'fd838566': 'Dónde está...' },
  },

  // Keyword stems added to a list after its English ones, by the English
  // word they answer; `*` is every resource.
  keys: {
    '*': {
      name: 'nomb', job: 'trab,ofic,ocup', bye: 'adi,hast,chao', join: 'unir,unet,acomp,ven',
      help: 'ayud', trai: 'entr',
    },
    '1802': {
      alar: 'alar', bond: 'lazo,vinc', odem: 'odem', cyth: 'cyth', mate: 'mate,madr', thei: 'thei',
      stor: 'rela,hist', jour: 'viaj', hist: 'hist', meti: 'mete', seld: 'seld', enes: 'enes',
      chry: 'chry', moth: 'madr', fath: 'padr', magp: 'magp',
      norm: 'norm', 'very easy': 'muy f', easy: 'faci', hard: 'dific', 'very hard': 'muy d',
    },
    '1803': {
      stor: 'rela', hist: 'hist', tale: 'leye', bond: 'lazo,liga', meti: 'mete', son: 'hijo',
      one: 'uno', two: 'dos', four: 'cuat', five: 'cinc', thre: 'tres', chrs: 'madr',
      king: 'rey', land: 'tier', wate: 'agua', wher: 'dond,sitio,lugar',
    },
  },

  text: {
    // the opening slideshow
    '0240': {
      '6a1d2ff5': 'Era otra calurosa noche de verano, con una humedad tan alta que dormir resultaba casi imposible.  El ventilador del techo del dormitorio no basta para vencer el bochorno.  A lo lejos, el estruendo sordo de un trueno: posibilidad de tormentas dispersas, había dicho el pronóstico.',
      '026d2989': 'Esa noche no iba a llegar un sueño reparador, y no era solo por el tiempo.  Sueños oscuros e inquietantes se demoran en el fondo de la mente, casi olvidados, pero no del todo.  Sus espíritus inquietos pugnan por salir a la superficie, pero no logran romper la barrera de la conciencia.  Formas oscuras, cosas muertas con un resplandor antinatural, una sensación de pérdida de control, y locura.  Corrupción y poderes antiguos, ajenos a la humanidad: cosas que parecen normales en la superficie, pero que por debajo están mal, muy mal.',
      '66bd0b5b': 'Levantarse, buscar consuelo en la televisión, pero no encontrar en ella más que anuncios necios que venden algún remedio milagroso o alguna estafa piramidal, pensados para robar los sueños y el dinero de los débiles.  Un vaso de agua, quizá, pueda ahuyentar las inquietudes del fondo de la mente.  Salir al patio caminando, como si aún se estuviera dormido, con el deseo de un aire quizá menos estancado.',
      '92a15a00': 'Se oye una brisa a lo lejos que agita las hojas de un roble imponente, pero no se siente alivio alguno del calor.  La tormenta se acerca por el oeste, con el cosquilleo del ozono sumándose al aire, y un resplandor verdoso y antinatural en las nubes.  Ese resplandor resulta de algún modo familiar, y perturbador.  Hacia el este el cielo sigue despejado, y se ven las estrellas: lo único que parece dar algo de consuelo.  Allí, baja y cerca del horizonte, Marte, antiguo dios de la guerra.',
      '38b28f63': 'Es entonces cuando llega la negrura, pero no la negrura de la noche, no la mera ausencia de luz.  Es la negrura del vacío, la ausencia de todo: de toda vista, de todo sonido, de toda sensación, de toda noción de tiempo y espacio.  Llega en un instante y dura una eternidad, antes de desvanecerse lentamente.',
      '1df7db47': '"Bien: nuestro salvador despierta", dice un bufón jorobado, vestido de arlequín.  Se vuelve hacia su compañero, un hombre mayor, más alto y distinguido, cuyo rostro es intemporal y a la vez lleva la huella de un número incontable de años.',
      '885e7a8a': '"Sí, Magpie, está bien.  Espero que tengas razón: estoy muy debilitado.  Haber lanzado el conjuro tan lejos, a través de tanto, por este... no sé."',
      '14ae8191': '"Confiar en Magpie, debes: ¿se ha equivocado alguna vez el consejo de Magpie?  Buena fue la elección, y el riesgo valía la recompensa.  Era tu última y mejor oportunidad de recobrar tu poder y de salvar la tierra de la destrucción.  Mucho descansa sobre los hombros de este joven, pero buena fue la elección."',
    },

    // Omen
    '1801': {
      '58b2f974': 'Kenny',
      '0542fa00': '\n¡Dios mío!  ¡Han matado a Kenny!  ¡Cabrones!\n',
      '8d55afbf': 'El amuleto se calienta en tu cuello y luego se deshace en polvo.\n',
      '11f782bf': 'El amuleto se calienta en tu cuello.\n',
      '616f1c67': 'Sientes una breve punzada de dolor en el amuleto que llevas al cuello, y luego la oscuridad de la muerte.\n',
      'de2eb96a': 'Mueres sin conocer el destino de Alaric.',
      '57e959c5': 'Un rostro de extraño aspecto aparece de pronto ante ti...*"Pobre humanito: tan lejos de casa, y tan lejos de la verdad..."*"Sabes, ¿verdad?, que Alaric no es todo lo que dice ser.  Cierto, está ligado a la tierra, pero como usurpador."*"No le corresponde el lugar de poder que ocupa, y con solo estar ahí trastorna el equilibrio del mundo."*"Y tú no eres más que otro de sus títeres.  Ha llegado la hora del cambio, y tú estás en el punto de giro."*"Pero ¿hacia dónde se inclinará la balanza?  ¿Hacia el Este?  ¿O hacia el Oeste?"*"¿Y yo?  Yo soy Omen, y mi amo me ha ordenado velar por alguien como tú."*',
      'e74f07fa': '"A un alto precio para mí acudo a ti, como visión, para advertirte y guiarte, protegerte y enseñarte."*"Sabe esto: aquí sucede más de lo que se ve a simple vista, una lucha por el poder tan antigua como el mundo."*"Y de esa lucha no tienes escapatoria.  Si esperas ser libre algún día, atiende bien a mi consejo."*"Alaric debe ser destruido para que la tierra se restaure, y al final serás tú quien lo haga."*"Para ayudarte en tu destino tenemos un pequeño regalo, como prueba de nuestra palabra."*"Pero antes debes aprender los usos de esta tierra, y con ese fin mi amo ha preparado una pequeña prueba de tus aptitudes."*"Pues has de afinar tus habilidades.  Como se templa una espada, así has de templarte tú."*"Busca la salida de este campo de pruebas, y por el camino quizá halles tu recompensa."*"Sigue nuestro consejo y tendrás una buena recompensa; ignóralo por tu cuenta y riesgo."*"Hasta que volvamos a vernos, mantente en guardia, y no te fíes de lo que ven tus ojos."*',
      'f1918e25': 'La visión de Omen vuelve a aparecer ante ti...*"¡Excelente!  ¡Has encontrado la primera pieza de la Crolna!"*"Te será muy útil, créeme.  Busca el resto..."*Tan de repente como llegó, la visión se desvanece.*',
      '2b4c5b74': 'De nuevo, Omen aparece ante tus ojos...*"Ah, veo que has empezado a recomponer la Crolna entera.  ¡Excelente!"*"Ahora te acercas al corazón del misterio.  Una vez completa, la Crolna podrá curar la tierra."*"Claro que necesitarás valor para empuñarla, pero tenemos fe en ti y en tu juicio."*"Cuidado con tu enemigo, eso sí, pues te enredará con mentiras escondidas en medias verdades."*Omen se desvanece...*',
      '866e9170': 'Omen aparece de nuevo en una visión...*"Lo has hecho bien, y estamos orgullosos de tus logros.  Ha llegado la hora de que cumplas tu destino."*"Sabes lo que tienes que hacer: ¡no nos falles!"*Omen se desvanece...*',
      // "A ready hero" + "ine" (for a heroine) + ", out to save the world.":
      // Spanish cannot make heroína of héroe by a suffix, so the line says
      // it with a noun whose gender is not the hero's, and the suffix goes.
      'eae9ac6b': 'La visión de Omen aparece ante ti...*"¡Te doy la bienvenida al ancho mundo de Cythera!  Toda una figura heroica',
      'a6e99921': '',
      '31dbcf90': ', dispuesta a salvar el mundo."*',
      'a6f55c98': '"Ah, por cierto, no te preocupes: ninguno de tus compañeros de aventura puede verme."*"Ni siquiera se dan cuenta de lo que pasa: no son lo bastante rápidos para captar este instante."*',
      '509d306b': '"Correr aventuras en solitario puede ser peligroso: quizá deberías haber reclutado a alguien de la Sala del Rey de la Tierra."*',
      '2938be5d': '"Quizá ese joven y entusiasta Hector quiera acompañarte.  Valdría la pena preguntarle, si su padre le deja hacerse mayor."*',
      'c697527f': '"Quizá algún joven guerrero entusiasta de la Sala del Rey de la Tierra quiera acompañarte, si su padre le deja hacerse mayor."*',
      '8c914fb7': '"Básicamente hay dos cosas importantes que debes investigar cuanto antes: una plaga en Catamarca y un secuestro en Odemia."*"Sea como sea, basta con seguir el camino por la costa: Odemia es la primera ciudad que encontrarás, y Catamarca la segunda."*"Buena suerte, y para empezar quizá te convenga viajar solo de día, pues de noche salen criaturas peligrosas."*"Y hagas lo que hagas, ¡aléjate de la orilla!"*Omen se desvanece...*',
      'd8825016': 'La visión de Omen vuelve ante ti...*"Cademia.  La Ciudad Madre.  Quien ha vivido en Cademia no puede sentir ningún otro lugar como su hogar."*"Ten cuidado aquí: hay diversos maleantes que rondan los callejones, sobre todo de noche."*"Mucho yace enterrado bajo sus antiguos edificios: la ciudad tiene una larga historia que ya se ha perdido."*Omen se desvanece...*',
      'bf63e3eb': 'La visión de Omen vuelve ante ti...*"¡Peligro!  ¡Corres un gran peligro!"*"Cuidado con lo que yace enterrado aquí: ¡hay cosas que es mejor no remover!"*"Tú eliges tu camino, pero lo que hay aquí destruiría el mundo si se liberase."*"¡Y ni siquiera Alaric con todos sus poderes podría detener esa abominación!"*"Te dirá cualquier cosa para que cumplas su voluntad: ¡no te rebajes ni a hablar con ella!"*"Te lo suplico, déjalo estar..."Omen se desvanece...*',
      '65193bdf': 'La visión de Omen vuelve ante ti...*"La perdida Abydos, hoy solo el recuerdo de un gran fracaso..."*"Ninguno de los Magos se atreve a admitirlo, pero Abydos fue destruida por su jefe."*"El Mago Tavara destruyó la ciudad cuando el pueblo rechazó su mando."*"Si entras en los túneles bajo la ciudad, hasta encontrarás su taller, pero ten cuidado."*"Ese lugar lo guarda un temible ser mágico al que tú llamarías demonio."*"No digas que no te avisé."Omen se desvanece...*',
      'ccb952cc': 'La visión de Omen vuelve ante ti...*"Lo estás haciendo bien: recomponer la Crolna es lo más importante para tu éxito."*"Pero quedan más piezas por encontrar: cuatro en total."*"Conseguir las dos primeras fue lo fácil: las dos siguientes pondrán a prueba de verdad tu valía."*Omen se desvanece...*',
      'eb7375d6': 'Tus actos manchan tu alma.\n',
      '57c0d35a': 'Hablar solo es señal de inestabilidad.\n',
    },

    // Alaric
    '1802': {
      'd17d55fa': 'Yum',
      'f2d18230': '"¡Lo has conseguido!  Es extraordinario, asombroso.  Siento... me faltan palabras."*"Es como si se hubiera levantado una niebla, como si hubiera recobrado la vista.  Siento cada brizna de hierba."*"La tierra ha sufrido, pero tú has ayudado a curarla, y con ella a mí."*"Guardaré este artefacto a buen recaudo: sus poderes han vuelto a afinar mis sentidos."*"No sé cómo pagarte el servicio que has prestado, no solo a mí, sino también a la tierra."*"Te devolveré a tu tierra, como te prometí.  Gracias otra vez."*Alaric pasa las manos ante ti, y tu vista se oscurece...*',
      '2868b48b': 'Ante ti se alza un caballero mayor y distinguido',
      'ff91f5ff': ', pero con un gesto de desesperación.',
      '812ee964': ', con un gesto de satisfacción.',
      '181c8149': 'Justo antes de que tu vista se apague del todo, el rostro de Alaric vacila.*',
      '89f2f233': '"Sí, gracias por tu insensatez, mortal: sin ti jamás habríamos logrado dominar al que un día fue Alaric."*"Con los poderes de la Crolna, la Sala del Rey de la Tierra y toda la humanidad de nuestro lado, acabaremos pronto con los Seldane."*"Y después podremos librarnos también de los humanos: nuestra victoria está sellada."*',
      'fd160311': 'Has condenado a Cythera a las tinieblas.',
      '1fd0c53d': ', con un gesto de alivio y calma.',
      '91098480': 'Justo antes de que se apague del todo, la visión de Magpie aparece ante ti.',
      '06c01ba4': '*"Bahoudin te agradece que hayas curado a Alaric.  Si Chrysothemis, la madre de Alaric, viviera hoy, te lo agradecería."*"Por desgracia, no vive.  Aun así, su esposo, Bahoudin, padre de Alaric, te agradece que hayas salvado a su hijo."*',
      '41ec58b1': 'Has salvado a la tierra de Cythera de las tinieblas.',
      '0826a603': '"Ah, bien, ya estás en pie.  Temíamos que hubieras sufrido algún daño."*"Supongo que debería explicarte lo ocurrido.  Me llamo Alaric, y estás en la tierra de @Cythera."*"Te trajimos aquí en un último y desesperado intento de salvar a Cythera y a su soberano del caos y la locura."*"Yo soy ese soberano, y tengo un @lazo especial con la tierra y con las gentes de Cythera.  Durante más de doscientos años he usado mi magia para mantenerla próspera."*"Por desgracia, en los últimos años mi poder ha menguado, y con él Cythera ha empezado a hundirse en el caos."*"Es como si ese lazo se estuviera disolviendo, como si la tierra cambiara de algún modo.  No lo entiendo."*"Cuanto más impotente me vuelvo, más me frustra ver cómo todo se me escapa, como al despertar de un sueño..."*"He confiado en que los hados convocaran a un forastero, de la mismísima @Mater Theia, pues solo un forastero podrá ver a través de esta nube que me ciega."*"Tú, por supuesto, eres ese forastero.  No creas que lo hice por capricho: me ha costado casi todo el poder que me quedaba."*"Debo confiar en que me ayudes.  Siento el peligro que esto te supone, pero eres mi última esperanza, y la de Cythera."',
      'b89df01a': 'Ayuda',
      '1e127109': 'Entrenar',
      'c29c2832': '"Soy Alaric, ¿te lo había dicho ya?  Perdona, qué descortés por mi parte.\n"',
      '9ff3e30e': '"Soy el guardián de la tierra de Cythera,',
      '556486fc': ' gracias a ti."',
      'c017d43e': ' aunque a veces me siento como un extraño."',
      'd0f03eeb': '"Mmm, deja que te examine..."*',
      '8a80b432': '"Ya está, eso debería ayudarte..."',
      '7f0cb2fd': '"Tienes bastante buen aspecto tal como estás."',
      '0575b83a': '"Lo siento, pero tu alma está demasiado manchada para que yo pueda limpiarla."',
      '0ac81798': '"Lo siento, no puedo ayudarte hasta que registres este programa."',
      'c3b132ff': '¿Qué parte de tu identidad básica quieres entrenar?',
      'e6698669': 'Mente',
      '428a1095': 'Cuerpo',
      'c17e895f': 'Reflejos',
      '35afca3b': 'Cancelar',
      // "Your " + one of three parts + " been improved."
      '5736375e': 'Has mejorado ',
      '59fead01': 'tu mente',
      'accd7fad': 'tu cuerpo',
      '0576027b': 'tus reflejos',
      '292b7d27': '.',
      'a0bccf09': '"No tienes experiencia suficiente para seguir entrenando."',
      '44ec12b8': 'Nivel de dificultad: normal.',
      '5bd3f695': 'Nivel de dificultad: muy fácil.',
      'f325c1db': 'Nivel de dificultad: fácil.',
      '1e678b12': 'Nivel de dificultad: difícil.',
      '4356b8bc': 'Nivel de dificultad: muy difícil.',
      'c8a475a4': '"Toma, llévate este amuleto: lleva mi símbolo.  Si lo llevas al cuello, te salvará la vida si mueres."*"También puedes usarlo para traer de vuelta a un compañero desde las salas de la muerte, pero ten cuidado: sus usos son limitados."*Te entrega un amuleto con una cadena de oro.*',
      'b873b91e': '"Aunque te falten dotes mágicas, los pergaminos te serán útiles de todos modos."',
      '53c35a10': '"Aunque tus poderes mágicos son débiles, una visita al Magisterium de Pnyx los sacará a relucir al máximo."',
      '5eb6c7bc': '"Deberías visitar el Magisterium de Pnyx para aprender a usar tus poderes mágicos."',
      '4bda90c1': '"Tienes un don para la magia: un viaje al Magisterium de Pnyx valdrá la pena."',
      '1c22b52d': '*"He dispuesto unos aposentos para ti: Magpie te los mostrará."*',
      'cfed1719': '"Seguir a Magpie, debes."*',
      '6594c0b0': 'Magpie señala el extremo norte del pasillo.*"Al final del pasillo, la Biblioteca está."*"Mucho saber allí puede hallarse, en los libros que los mayores escribieron.  Bien te haría aprender."*',
      '27e55c22': '"Estos son tus aposentos.  Provisiones allí dentro hay."*"Las cosas de tus aposentos tuyas son; bien te servirán."*"Pero cuidado con robar a los demás.  Cythera es una tierra honorable, y tales actos mal te servirán."*Magpie mira rápidamente a su alrededor.*"Magpie es el bufón, pero hasta Magpie sabe que peligroso será tu viaje, joven."*"Bien te haría aprender cuanto puedas.  Visitantes importantes van y vienen, pero como tú no hay nadie."*"Demodocus se aloja al otro lado del pasillo, por ahora.  Hablar con él, Magpie haría, si Magpie tú fuera."*"Además, uno podría preguntar por ahí si alguien quisiera @unirse a tu misión..."',
      '9e13a481': '"Por favor, haz lo que puedas por ayudarme."',
      'c6388132': '"Odemia es la ciudad más cercana: viaja hacia el este, siguiendo la costa."',
      '431b0772': '"Sí, Cythera es la tierra."',
      '9d69f6ab': '"Vuelvo a ser uno con la tierra, gracias a ti."',
      'f2f796e0': '"Soy, o era, uno con la tierra y con sus gentes.  He provisto a su pueblo de todo lo necesario: una tierra fértil, un clima templado y paz para sus gentes."*"Pero ahora todo parece escapárseme: un vacío donde no puedo ver ni obrar."',
      '180c199b': '"Mater Theia, la Madre Tierra, al menos antes de que el @Viaje nos trajera aquí.  Ahora estamos sin Mater Theia, pero quedan @relatos."',
      'd3bbb4bd': '"Los relatos hablan de un poder, hecho de Tierra, que aún camina por esta tierra, al que llamamos los Metecos."*"Sin embargo, dudo que sigan con vida, o habría podido percibir su presencia."',
      'eedf5df1': '"No somos de este lugar, sino de la misma Tierra que tú.  Vivíamos en una isla llamada Thera, hasta que Enesidaone la reclamó."*"Pero no fue sin aviso, pues apareció un forastero, con la forma del Toro Sagrado, y nos dijo que huyéramos.  Vimos Thera destruida desde la seguridad de nuestras naves en el mar."*"Aquella noche una tormenta como no ha habido otra nos zarandeó, hasta que por la mañana despertamos, arrojados a la playa cerca de lo que llegaría a ser la ciudad de Cademia."*"O eso cuenta la leyenda.  No soy @historiador; quizá deberías preguntar a otro..."',
      '9a642326': '"Hay días en que no recuerdo lo que pasó el día anterior, y mucho menos la historia más antigua."*"Por alguna razón, sin embargo, el número 201 me parece importante.  Si averiguas por qué, dímelo, por favor..."',
      'eb69b0fb': '"De mi historia recuerdo algunas partes.  Vivía con mi madre, de niño, en Catamarca.  Cuando ella murió, dejé Catamarca para vagar."*"Cómo sobreviví, no lo sé.  Creo que buscaba a los Magos desterrados, pues sentía que tenía poderes más allá de los de la gente corriente, y quería conocerlos."*"En vez de encontrarlos, me metí en una cueva, pero no era una cueva.  Crucé un puente de estrellas y encontré una sala abandonada, o un templo de alguna clase."*"Quién construyó ese lugar, no lo sabía.  Estaba vacío y abandonado, pero un gran poder me llamaba."*"Recuerdo estar al borde del Abismo, y sentir que me entregaba a él, que me hacía uno con él, con la Tierra."*"Fue entonces cuando me convertí en el Rey de la Tierra.  No sé cuánto tiempo estuve allí: años, eso seguro.  Y al final había completado el lazo."*"Supe entonces que había que poner fin al gobierno de los Tiranos.  Y así lo hice, y de ello nació el sistema actual de Casas y Jueces."*"Todo eso parece fallar ahora: quizá mi tiempo haya terminado..."',
      '608d836d': '"Sí, ese es el día en que murió mi madre."',
      '9bcbd37e': '"Ese número me parece importante, pero no sé por qué."',
      'f2635457': '"Los Metecos son quienes vivían en Cythera antes de que llegáramos.  Sus ruinas pueden encontrarse a las afueras de Pnyx, y he oído que se han descubierto más en la Ciénaga de Khalkis."*"Deberías buscar a un Mago Libre llamado Timon: los ha estudiado."',
      '7e85745e': '"Enesidaone, Mater Theia, los viejos dioses.  Ya no guían nuestro destino.  Por desgracia, ahora lo más parecido a una deidad soy yo..."',
      'b6d17099': '"Chrysothemis era mi madre: a ella la recuerdo bien."',
      'b2acfe71': '"Sí, era mi madre, ahora lo recuerdo.  Fue en el 201 cuando murió.  Sí, ese fue el principio de todo."*"Vuelvo a recordar partes de mi @historia.  Quién sabe por cuánto tiempo, eso sí..."*',
      '632cd76b': '"A mi madre la recuerdo, pero no del todo: ahí falta una parte de mi memoria..."',
      'cc3eb62b': '"Chrysothemis era mi madre: ahora la recuerdo bastante bien."',
      'bb503a38': '"De mi padre no recuerdo nada: quizá lo recordé alguna vez, pero ya no..."',
      'a1c7b4d2': '"Magpie será mi bufón, pero es un consejero de confianza."',
      '619066d3': '"¿Perdona?"',
      'deb1d58b': 'Se queda mirando al vacío.\n',
    },

    // Magpie
    '1803': {
      '6b450cc0': 'Ves a un jorobado vestido de arlequín, sentado en el trono.\n*"Magpie solo le guarda el sitio a Alaric, nada más."',
      'c00c4afe': 'Ves a un jorobado vestido de arlequín, de aire afable.\n',
      '5f6e48f7': '"Por favor, habla primero con el amo."',
      '4651e3b1': '"Muchos nombres Magpie tiene."',
      '38821e6a': '"¡Magpie es el Bufón del Rey!  ¿No basta con eso?"',
      'e6e8dee5': '"Lo siento, pero el sitio de Magpie está junto a Alaric."',
      'd7e9daae': '"Un relato que no puede contarse, es."',
      'e9ecc9a3': '"La historia está en todas partes, pero nadie le pregunta a una roca su historia."*"La historia de Magpie, eso sí es un @relato, pero la historia de Alaric, eso sí que es una @leyenda."',
      '1d41cf54': '"¿La leyenda de Alaric?  ¡Su historia es historia!"*Alaric ríe y hace cabriolas como si hubiera contado el mejor chiste jamás inventado.*"Alaric fue quien acabó con el gobierno de los Tiranos, y quien hizo volver a los Magos del destierro."*"Él fue quien estableció el gobierno tal como hoy es.  Pero nadie sabe cómo obtuvo el poder para semejante hazaña."*"O al menos, nadie lo dirá.  Nadie es ninguno.  Y ninguno no es uno.  Y no uno es dos."*Alaric vuelve a sonreír encantado.',
      '7b492933': '"Quizá compartamos más historias..."',
      '1c45d64e': '"Un lazo mágico Alaric tiene con la tierra, que le permite asegurar su prosperidad.  Por eso lo llaman el Rey de la Tierra."*"Y este lugar es, por tanto, la Sala del Rey de la Tierra, la Sala del Rey, la Sala de Alaric."*"En verdad, rey de algo más que la Tierra seguro que es."',
      'd443a855': '"Ese no es un lugar donde Magpie sea bien recibido."',
      '9eede4c2': '"Allí Magpie es bien recibido, o al menos lo era."',
      '2df7d566': '"La Ciudad de los Hechiceros.  Ellos sí saben tratar a Magpie."',
      '98439601': '"Los Metecos son una leyenda, pero también lo es Magpie, y los dos son reales."*"Los conoce, Magpie los conoce.  Bien recibido por ellos, Magpie no es."',
      '50ba4a2c': '"Seldane, Seldine, ¿no son todos lo mismo?  Metecos con cualquier otro nombre."',
      '984fabeb': '"Un hijo Magpie tiene, y lo has conocido.  @Tres que son uno, él es.',
      '8d0bbc53': '  Más Magpie no puede decir.',
      '3698df6a': '"Es fácil decir que uno es, ¿o no?  ¿Puede uno decir de verdad lo que uno es, y lo que uno no es?"*"¿Es uno realmente uno, o quizá dos?  ¿Tal vez incluso tres?"',
      '2fe3f108': '"El dos no importa, pero ¿el tres?"',
      '82d4432a': '"¿Podría haber cuatro?  ¡Con el hombre, puede haber hasta cinco!"',
      '056d254d': '"Si de cinco se pierden dos, no quedan sino tres."',
      '357e3360': '"Jhaixus es uno.  Jinrai es uno."*"Bahoudin es dos.  Chrysothemis es una."*"Alaric es tres."',
      '7782c527': '"Ah, tres, eso sí es importante, pero para ese conocimiento aún no ha llegado tu hora."',
      'd77fd1ca': '"Madre de Alaric, esa es."',
      '37562cae': '"Conoces el nombre: una herramienta peligrosa es, pero una herramienta al fin y al cabo."*"Una herramienta para abrir, una herramienta para cerrar."*"Una herramienta para construir, una herramienta para destruir."*"Una herramienta para sanar, una herramienta para envenenar."',
      '383eb298': '*"Sabinate tiene razón quizá, pero uno puede equivocarse cuando tiene razón."*"Magpie teme que sea la última y mejor esperanza de Alaric: grande es el riesgo."',
      'f2c3ef84': '"No todas las visiones ven hasta el fondo de la verdad de lo que es, y de lo que nunca debe ser."',
      'dca5d642': '"Esa es una historia que a Magpie no le toca contar."',
      '899b95f7': '"Un nombre antiguo, que ya no se usa."',
      'a0353947': '"Mucha gente tiene muchos motivos, y no todos auguran nada bueno."',
      '97504b08': '"La gente de Jinrai es peligrosa, muy peligrosa."',
      'b6cd7e3f': '*"Recuerda bien que los muertos no caminan."',
      '1b2a015e': 'Echa un rápido vistazo a Alaric, como para ver si está escuchando.*"Esa es una historia que a Magpie no le toca contar."',
      '646724b7': '"Por favor: ese nombre no es seguro.  Magpie nunca usa ese nombre."',
      '1b7282cf': 'Mira rápidamente a su alrededor.*"Magpie y Bahoudin, muchas historias.  Esa historia es cierta."*',
      '87f317e6': '"Jhiaxus me dijo que te dio la Llave del Pilar Derecho."*',
      'e06f2416': '"Sí, verdad dice Jhiaxus.  Magpie te la entregará, pero hay un gran peligro."*',
      '9d9f34e1': '"¿Peligro?  Hasta ahora me las he arreglado."*',
      'd5ba26b3': '"Gran peligro para todos.  Los temores de Magpie se cumplen..."*"Tú nos salvarás a todos..."*"...o nos destruirás a todos."*"Solo tú tienes el poder de elegir."*"Magpie ve mejor que Sabinate o que Jhiaxus, pero esto no se ve."*"Sabinate y Jhiaxus tienen sus propios motivos: recuérdalo."*',
      '5d8c1330': '"El Rey es Alaric y Alaric es el Rey, @ligado a la @tierra."',
      '84ccf3a3': '"Tierra y agua, agua y tierra: esas dos no son una, salvo para dos, que son dos y tres."',
      'b0c09585': '"El viejo Ignae es un embaucador: el astuto es él."',
      'baeda81c': '"De guía turístico Magpie ya te ha hecho una vez."',
    },

    // the papers: the Test's notes among them
    '0219': {
      '398bcbce': 'D -\nSecuestro realizado\nEnviaremos la nota de rescate cuando digas que estamos listos\n-E',
      '297f6ff1': 'El tesoro está a salvo, enterrado cerca del recodo del río.  Árboles plantados 4 pasos al E, 7 pasos al O, 8 pasos al N y 4 pasos al sur.',
      'e95f93ac': 'Mi Señor:\nLa Casa Comana ha ganado apoyo popular en Cademia.  La Casa Attis no está contenta, pero no detecto juego sucio.  Seguiré investigando.\n--Berrosus',
      'ed871abd': 'Nota para mí mismo: tomar medidas para que los fisgones dejen de leer mis notas.',
      '03eff95e': '--Contrato de Vino--\nApis acuerda comprar a .................... vino en cantidad de ......... barriles, a un precio de 100 óbolos por barril, que se entregará contra pago.',
      '0d154653': 'Aeacus, O.T.H.\nPeligro para el Templo Exterior: ¡el Tirano se mueve!  El TE puede caer, pero debemos preservar la Hermandad Interior a toda costa.\n--Tavara, H.H.I.',
      'e22f3f48': 'Aquí tienes tu última remesa de kesh, pero necesitamos más, así que aumenta la recolección de huevos de arpía: debes cumplir tus cuotas semanales.  Sigue racionando a tus hombres, incluso cuando estén en el campamento: no queremos que Alaric ni los Magos nos descubran.  Pero una vez que sean adictos, podrás reducirles la dosis a un cuarto para alargar la remesa sin perder la protección.  Pese a los pequeños reveses de los últimos tiempos (sobre todo ese idiota de Antiphus), nuestro plan sigue adelante.  Asegúrate de dejarles claro que el precio del fracaso es peor que cualquier pesadilla que puedan tener (nuestros aliados se encargarán de ello), pero que el éxito los recompensará con más riqueza de la que sabrán qué hacer.',
      'cb41120f': 'Te doy la bienvenida, Humano, a mi pequeña prueba.  No es difícil de superar, y te dará algunas de las habilidades que necesitas para sobrevivir (aunque quizá te sientas como una criatura enjaulada).  Espero que Omen no te haya asustado.  Su aspecto es extraño, pero no dejes que te engañe. \n\nYa has superado la primera parte de la prueba: has leído esta nota.  Ahora debes tirar de la palanca cercana para abrir la reja que lleva a la sala siguiente.  Allí encontrarás una trampilla cerrada con llave.  Encuentra la llave, ábrela y baja por la escalera.',
      'aca1c7e7': 'Lo siento, la llave no está en este cofre, pero buen intento.  Mira al sur: ¿notas algo interesante en la pared?  Prueba a usarla...\n\nAh, quizá te convenga usar una de las antorchas de este cofre: te dará algo de luz si la empuñas.',
      '5073b74b': 'Ah, muy bien, qué buen ojo, has encontrado esa segunda puerta secreta; pero no todos los hallazgos como este llevan a una recompensa, por desgracia.  Este, en cambio, sí...',
      'e86dd49f': 'Esta sala es más difícil: la puerta está cerrada por un conjuro.  Solo tienes una oportunidad de abrirla: coge ese objeto de extraño aspecto, lo que tú llamarías una bomba.  Recógela, úsala para encenderla y luego lánzala de modo que caiga justo al lado de la puerta.  Apártate y deja pasar el tiempo...',
      'adb6e14d': 'No todas las palancas son fáciles de encontrar: quizá si reordenaras un poco las cosas aquí... (no te preocupes: todas las cajas están vacías, así que es fácil moverlas, ¡y no hace falta que pierdas el tiempo registrándolas!)',
    },

    // character creation: the classes, what each is, the figures, the skills
    '0203': {
      'ded347ea': 'Explorador', 'aa09eb22': 'Luchador', 'fc04f3c1': 'Espadachín', '716a4728': 'Berserker',
      '488a02e3': 'Mago', '42181c2a': 'Hechicero', '76bc7264': 'Místico', '7ca5b0a6': 'Juglar', '4efd5a0d': 'Pícaro',
    },
    '0204': {
      'ffa3d9b3': 'Un explorador es quien aprende mucho del mundo, pero aún no domina nada de él.  Un personaje equilibrado, sin virtudes ni flaquezas especiales.',
      '7b962f23': 'Un luchador es quien domina las artes del combate, con equilibrio entre ataque y defensa.',
      '28227528': 'Un espadachín es un luchador especializado en el uso de la espada y el escudo.',
      'd8f6504b': 'Un berserker es un luchador que se lanza al ataque con todo, renunciando incluso a las armas.',
      '3e3f8a76': 'Un mago es quien domina las artes místicas, con equilibrio entre la búsqueda del poder y la del saber.',
      '178f58a8': 'Un hechicero es un mago especializado en conocer las artes místicas con la base más amplia posible.',
      '26cd9c66': 'Un místico es un mago especializado en los poderes interiores, aun a costa de una base amplia.',
      'bac672f9': 'Un juglar es quien vaga por las tierras, con un don natural para ganarse a su público.',
      '31bd378b': 'Un pícaro es quien domina algunas de las artes más engañosas.',
    },
    '0205': {
      'c9accf56': 'Cuerpo: 16  Reflejos: 16  Mente: 16',
      '0d32f7b2': 'Cuerpo: 18  Reflejos: 18  Mente: 12',
      'f62d78ac': 'Cuerpo: 17  Reflejos: 19  Mente: 12',
      '4f2c70ea': 'Cuerpo: 20  Reflejos: 16  Mente: 6',
      'd4bff86f': 'Cuerpo: 10  Reflejos: 18  Mente: 20',
      'df5569a2': 'Cuerpo: 16  Reflejos: 18  Mente: 14',
    },
    '0206': {
      '8fe7859b': 'Ataque[2], Defensa[2], Maná[2], Conjuros[2]',
      '743b3fff': 'Ataque[4], Defensa[4]',
      'ba4460c7': 'Ataque[2], Defensa[2], Espada[2], Escudo[2]',
      '6d54e6be': 'Ataque[6], Sin armas[2]',
      '3499f42d': 'Maná[4], Conjuros[4]',
      'a2d93f15': 'Maná[2], Conjuros[6]',
      'eebe709d': 'Maná[6], Conjuros[2]',
      'b1c84931': 'Ataque[1], Defensa[2], Proyectiles[1], Persuasión, Regateo',
      '2038ea8f': 'Ataque[2], Trampas, Percepción, Cerraduras',
    },

    // the zones' names, where they are set as the map window's title
    '1403': { 'bc932de6': 'Sala del Rey de la Tierra' },
    '1428': { 'e160b22e': 'Bajo Cademia', '79d82e8c': 'La Prueba de Omen' },

    // the To Do list
    '021A': {
      '3ade9a26': 'Curar a Alaric',
      '3f13f97c': 'Aprender magia en el Magisterium',
    },
  },
};

/* ---- what is the same everywhere, and the name table ---------------------- */

Object.assign(DELV_TRANSLATION_ES.text, { '*': {
  '5b67d272': '=', '437e0a7b': '=', '26c851f2': '=', 'dd29a156': '=', 'b25d9bdf': '=',   // Pnyx, Cademia, Odemia, Catamarca, Kosha
  'dcdf735e': 'Sala del Rey de la Tierra',
  '35afca3b': 'Cancelar',
  'a37275d9': '"Adiós."',
  'c60336a8': '"Adiós."',
  '166ac178': '"Adiós."',
  '5f45f94d': '"¿Sí?"',
  '619066d3': '"¿Perdona?"',
  '9e62d4e5': '"De eso no sé nada."',
  '33d8285e': '"Adiós, forastero."',
  'df3d6094': '"En otra ocasión, entonces."',
  '8f1b4536': '"Lo siento, no se fía."',
  'e58978c1': '"Parece que te falta algo de dinero; lo siento, pero no se fía."',
  'fa9a82b2': '"No sabes lo que te pierdes..."',
  'd1cb0a36': '"Me temo que no puedo decirlo."',
  '8c8a580d': '"Quizá en otro momento."',
  '133fd9ac': '"Vuelve cuando quieras."',
  'e5aeba98': '"Vuelve, por favor."',
  '6ec7aca8': '"Muy bien, pero date prisa..."',
  '4f2182e4': '"Con mucho gusto."',
  '6348740b': '"¿Sí, amigo mío?"',
  'b102103f': '"Adiós, y ten cuidado."',
  '7c8bc76d': '"¡No lo olvides!"',
  '46a071b7': '"Sí, basta con ejecutar el programa Register Cythera: ahí están todos los detalles."',
  'ad589b13': '"No soy más que un guardia, y no se me permite hablar de esas cosas."',
  '75cc84d2': 'Ves a un guardia de aspecto muy serio.*',
  'bcc29697': '"Ahora mismo no formo parte del grupo.  Quizá debería @unirme a ti."',
  'cfacfa6f': '"Ahora mismo no estoy esperando para volver contigo.  Quizá debería @unirme a ti."',
  'a9f28980': '"Te esperaré aquí hasta que vuelvas."',
  '20ead0bb': 'No pasa nada.\n',
  '5cc99ade': 'No parece que pase nada.\n',
  'cec6518b': '¡Cerrado con magia!\n',
  'f89e568f': 'Parece ser un interruptor o un botón de alguna clase.\n',
  'f2d9a920': 'La jarra ya está llena.\n',
  'b43d38a0': 'Es una pequeña habitación privada de la posada, con solo una cama y una ventana.\n',
  '350e10c8': 'Ves a un minero fornido.*"¡Ninguno de nosotros va a volver a esa mina con ese fantasma dentro!"',
  'ad3ccf1c': '"Me temo que no puedo ayudarte: esto no corresponde a ninguno de los fonemas que he asignado a las inscripciones."',
  '0bd501c0': 'Esperar', 'fa2f3260': 'Irse', '8aad7d90': 'Seguir',
  '737e46e3': 'Costillas', 'e81fffc8': 'Queso', '2fd9d583': 'Pescado', '9cd96b85': 'Pan',
  '3bac8e59': 'Casa Nicander', 'debda84f': 'Casa Strymon',
  'e160b22e': 'Bajo Cademia',
  'cd0ec436': 'Espada', '8ba9331d': 'Ataque',
}});

DELV_TRANSLATION_ES.names = { '0201': {
  'd479de7d': 'Guardia de la Sala', '619c6efa': 'Guardia de Cademia', 'c083c9e1': 'Guardia de las Ruinas',
  'b08402a6': 'Guardia de Kosha', '61cc008f': 'Guardia de Odemia', 'ba18288b': 'Guardia de Catamarca',
  '206b7d0f': 'Guardia de Pnyx', 'b8198c4f': 'Guardia de la Puerta',
}};

/* ---- the text resources: signs, papers, numbers, rings, graves, endings --- */

Object.assign(DELV_TRANSLATION_ES.text, {
  '0210': { 'cc01b1df': 'Volver' },
  // Signs. A Seldane sign is the Seldane words between < and >, drawn in
  // the Seldane face and left alone, then a word-for-word gloss between the
  // two &, which keeps the Seldane order in Spanish as it does in English.
  '0218': {
    'b30f54d2': '<ERI AY N USXT WN>&El guardián de la puerta de sala esta&',
    'f3a4e745': '<ARIT ABT NT SBY PN>&El poste izquierdo de puerta esta&',
    '17181a6b': '<ARIT UNM NT SBY PN>&El poste derecho de puerta esta&',
    'f667e0a9': '<SYTI N SBY PN>&El umbral de puerta esta&',
    '5da2aba2': '<ERI AY N SPY PN>&El morador a la puerta de puerta esta&',
    'a5f32689': '<HPTU N SBA PN>&Los postes de puerta esta&',
    '9b81d9a6': '<BNV N SBA PN>&El cerrojo de puerta esta&',
    '5d34bfc7': 'Bienvenidos a Odemia',
    'fa117553': 'Catamarca - Ciudad de los Manantiales',
    '0d916c15': 'Viñedo de la Costa Norte, fundado en 817',
    'ce8da29f': 'La Cabeza del Titán',
    'b0ac1747': 'La Cabra Verde',
    '11279de4': 'La Rata de Dos Colas',
    '210942ab': 'Minas de Hierro',
    'fb0f94f4': 'A Cademia', '666478cd': 'A Catamarca', 'b6a1960b': 'A Odemia', 'd5c4fab7': 'A Pnyx', 'ef453804': 'A Kosha',
    'e6dbfc18': 'Bienvenidos a Abydos',
    'fe9d3035': '¡Gana óbolos rápido!\nEnvía 1 óbolo a cada uno de los nombres de abajo y luego añade tu nombre al final de esta lista...\n',
    '694789ee': 'Director Lindus', '513aa10c': 'Bibliotecario Selinus', 'e1ca5322': 'Maestro Pheres', 'eea59ba9': 'Maestro Tros', 'e373ea8a': 'Maestra Palaestra',
    '7d040eda': 'Sala del Cuarto Grado', '743af491': 'Sala del Quinto Grado', 'ce8c0a08': 'Sala del Sexto Grado', '14c8071d': 'Sala del Séptimo Grado', '90b3018b': 'Sala del Octavo Grado',
    '686f7a0c': 'Casa Dodona', '52e77950': 'Casa Attis', '95597760': 'Casa Atussa', '286628ec': 'Casa Comana',
    '139424fb': 'Se vende edificio\nPara más detalles, pregunta a Antenor.\n',
  },
  // The number words: the dice (0x1148, "the first black die is five") and
  // the books a librarian counts (0x1851), so the masculine forms.
  '021E': {
    '8b6fe763': 'cero', 'ba2719ef': 'uno', 'be248829': 'dos', '888603c3': 'tres', '2f69f5a5': 'cuatro', 'aeb44395': 'cinco',
    'ca3007ab': 'seis', '3583acfe': 'siete', 'd4fa8470': 'ocho', '16266f55': 'nueve', 'bd01f454': 'diez', '8ff53680': 'once',
    'f5352bb4': 'doce', '63374a36': 'trece', '01a53a61': 'catorce', '07cc2b2a': 'quince', 'c5d13fab': 'dieciséis',
    'a4c6ff66': 'diecisiete', 'a57e9c10': 'dieciocho', 'e21ee631': 'diecinueve', '00500da8': 'veinte',
  },
  // A ring's inscription, said after the ring
  '021F': {
    'f9f4711e': "con la inscripción '742 - Voluntad de Unión'",
    '7952052e': 'con un ojo grabado dentro de un triángulo que apunta hacia abajo',
    'd456c7ab': 'con una cruz grabada dentro de un triángulo',
    'fc565510': "con la inscripción 'Para Hapede, con amor'",
  },
  '0220': {
    'd86c6edb': 'Aquí yace Chrysothemis, Amada Esposa, Madre\n158-201',
    'fc73b998': 'Andromache\nAmiga y Esposa\n882-918',
    'f322cbb1': 'Hapmonides\nAmigo y Esposo\n878-918',
    '812c0fb7': 'Andra\nAmada Madre\n873-917',
    '4b59a3a1': 'Lycus\nPadre y Esposo\n870-910',
    '13918364': '=',
  },
  '0221': {
    '3313058d': 'Parece ser una especie de mapa tosco, con montañas, quizá algunos árboles, un poblado, y luego quién sabe qué más.\n',
    '84699e8e': 'Es un cartel de "se busca", aunque el parecido no es muy bueno, así que no está claro quién es el sospechoso.\n',
  },
  // the hero's death, and Alaric's two endings
  '0241': {
    '87fa7739': 'Tu cuerpo se desploma en el suelo, y toda la vida se escapa de él.  No hay segunda oportunidad para ti, no ahora.  Mientras tu espíritu abandona tu cuerpo, te preguntas qué será ahora de Alaric, de la tierra.  Sin tu ayuda, ambos están sin duda condenados.  Los últimos y fugaces latidos de vida te traen arrepentimiento, mientras a lo lejos juras oír una risa, hueca y burlona.',
    '99feff42': 'Has muerto.',
  },
  '0242': {
    'ba0ce1bd': 'Tu voluntad ya no está en tu cuerpo, y te invaden imágenes del futuro, de las consecuencias de tu fracaso.  No sabes cómo ves lo que ves, como si el ser que fue Pelagon se hubiera adueñado de tu mente para torturarte con las consecuencias de tu fracaso.',
    'e0301ba7': "Ves a Alaric, con el fiel Magpie a su lado, sentado en la sala del trono de la Sala del Rey de la Tierra.  Pelagon avanza a grandes pasos, con una criatura espantosa que conoces como Omen a su lado, y un resplandor verde en la mano.  Alaric se levanta, como para detenerlo, cuando un rayo de energía sale disparado.  En el último momento, Magpie se lanza delante de Alaric, y su cuerpo queda reducido a ceniza.  Pero ni siquiera ese último esfuerzo heroico salva a Alaric, pues un segundo rayo sale de la mano de Pelagon y consume a Alaric.  Pelagon sube al trono de Alaric, y se detiene a sacudir la ceniza que queda.  'Lo hemos hecho bien, amo', dice Omen, cuya forma vacila hasta convertirse en la de Magpie.  Pelagon sonríe, y su forma vacila hasta convertirse en la de Alaric, pero con un malvado brillo verde en los ojos.",
    'c8e4735d': 'Sabinate alza la vista de su meditación, con alarma en los ojos.  De pronto su rostro se ensombrece, y las lágrimas empiezan a correrle por la cara.',
    'cc5da50c': 'Una niña pequeña juega con un juguete en una calle polvorienta.  Se le cae el juguete y empieza a llorar.  Su madre la coge en brazos, pero no consigue detener las lágrimas, no consigue calmar el dolor.  Pues lo que le pasa a la niña es algo que no se irá, algo que solo empeorará con los años...',
    'd1eeab5e': 'No sabes con certeza qué has hecho, pero ahora sabes que el ser que fue Pelagon ha vencido y, con tu ayuda, ha derrotado a Alaric.  Sientes que tu voluntad abandona tu cuerpo y que, en poder del ser que fue Pelagon, se te obliga a contemplar las consecuencias de tus actos.',
    'df6da9b9': 'Una niña pequeña juega con un juguete en una calle polvorienta.  Se le cae el juguete y empieza a llorar.  Su madre la coge en brazos, pero no consigue detener las lágrimas, no consigue calmar el dolor.  Pues lo que le pasa a la niña es algo que no se irá, algo que solo empeorará con los años...',
  },
  '0243': {
    '124908cf': 'Despiertas con un sobresalto, de vuelta en tu cama.  Es de día: ¿fue todo solo un sueño, o algo más?  Te levantas y te miras en el espejo, y tu rostro refleja algo en ti que te hace pensar que fue más que un sueño.',
    '3ab8f432': 'Miras por la ventana; la lluvia de anoche se ha ido.  En un árbol cercano, una urraca grazna dos veces, como si intentara decirte algo, y luego se va volando.',
  },
});

/* ---- the To Do list: each line's title, then what it says --------------- */

Object.assign(DELV_TRANSLATION_ES.text['021A'], {
  'bfadf3e6': 'Rescatar a Ariadne, secuestrada',
  '979da5a0': 'Curar la plaga de Catamarca',
  '0717555d': 'Interrogar al bandido',
  'a9720538': 'Enseñar el cristal a Lindus',
  '9502d662': 'Llevar el cristal a Timon',
  '279f529a': 'Liberar Maayti',
  'dac12106': 'Encontrar al hijo de Sabinate',
  '696c35d2': 'Honrar a Jinrai',
  'fa5953fd': 'Preguntar a Halos por Comana',
  '2b070110': 'Llevar a Dryas ante Berossus',
  'c482f5de': 'El libro del flujo temporal, para Charax',
  '81bc0b67': 'Algas para Charax',
  '324e26d5': 'Investigar la mina de hierro',
  '77595420': 'Buscar a Prusa',
  'c6c5cd6d': 'Conseguir harina de Periphas',
  '9bbd4712': 'Negociar el contrato de vino',
  'e2725d3e': 'Recuperar los Libros de la Sabiduría (0/10)',
  '0d465431': 'Recuperar los Libros de la Sabiduría (1/10)',
  '2e35fca4': 'Recuperar los Libros de la Sabiduría (2/10)',
  'ef55c837': 'Recuperar los Libros de la Sabiduría (3/10)',
  '6246ff22': 'Recuperar los Libros de la Sabiduría (4/10)',
  'b5cc6ed5': 'Recuperar los Libros de la Sabiduría (5/10)',
  '7f749d18': 'Recuperar los Libros de la Sabiduría (6/10)',
  'cb55448b': 'Recuperar los Libros de la Sabiduría (7/10)',
  '719fffe6': 'Recuperar los Libros de la Sabiduría (8/10)',
  'db44f819': 'Recuperar los Libros de la Sabiduría (9/10)',
  'f2885a95': 'Recuperar los Libros de la Sabiduría (10/10)',
  'c6389c23': 'Encontrar un huevo de arpía para Pheres',
  'e636e1e8': 'Encontrar a Eioneus',
  '213a868a': 'Llevar piel de caimán a Alastor',
  '80e8adcd': 'Averiguar quién fue la madre de Alaric',
  '078d733c': 'Poner flores en la tumba de Andra',
  '2c0cc61a': 'Encontrar el anillo de Thersites',
  '324b5083': 'Llevar la red a Stentor',
  '45aed4cb': 'Descubrir el origen del kesh',
  '7fdd7cf5': 'Hablar con Stentor',
  'f1cfac8b': 'Encontrar el arma que mató a Opheltius',
  '3f4c1155': 'Preguntar a Dryas por el asesinato',
  '1c0f2117': 'Preguntar a Thuria por la mina de hierro',
  '3394adf4': 'Llevar la harina a Apis',
  'dc9656bf': 'La salud de Alaric, el Rey de la Tierra, se debilita, y con ella sus poderes para proteger la tierra.  Descubre la causa de este mal y cúralo.',
  'c2ad8907': 'Unos bandidos han secuestrado a la dama Ariadne, de la Casa Nicander, a las afueras de Odemia.  Rescátala y devuélvela a Odemia.',
  'eed8895b': 'Debes buscar los caminos del Mago en el Magisterium de Pnyx.',
  'f0bea469': 'Una plaga se ha abatido sobre la gente de Catamarca.  Encuentra la causa y, con suerte, una cura.',
  'ef89bf2f': 'El juez Sacas te ha pedido que interrogues a un bandido capturado cuando secuestraron a Ariadne.  Está en la prisión de Odemia.',
  'a742b9ae': 'Tras encontrar un extraño cristal luminoso bajo la Ciudadela de Catamarca, el juez Metopes propone llevárselo al director Lindus, del Magisterium.',
  'c91862bf': 'El director Lindus ha reconocido el cristal como uno parecido al que encontró el Mago Libre Timon, que explora las ruinas al noreste de Pnyx.',
  '122c7553': 'Sabinate te ha encomendado liberar Maayti, la ciudad seldane de la Verdad, de la corrupción que la mancha.',
  'c8fae82b': 'Para liberar la ciudad de Maayti, necesitas conseguir la segunda mitad de una llave del hijo de Sabinate.',
  '7aa17a84': 'Antes de hablar contigo, Jhiaxus necesita que honres la memoria de su amada Jinrai, ofreciendo a su Ka algo de pan hecho a mano.  Hay que hacerlo al otro lado del Lago de Fuego.',
  '31de5ef2': 'Halos, de la Casa Strymon, quizá sepa más sobre la implicación de la Casa Comana en el secuestro de Ariadne.  Búscalo en Cademia.',
  '5d624a3a': 'Dryas, la rata de alcantarilla, tiene miedo de ir en persona a ver a Berossus, pero tiene algo importante que contar para limpiar el nombre de Halos.  Tienes que protegerlo y llevarlo ante el juez Berossus.',
  '07d3ff61': 'Charax el Alquimista necesita cierta información de un libro sobre el "flujo temporal" que vio una vez en la biblioteca del Magisterium.',
  '70b3d38c': 'Para que funcione la reacción del flujo temporal, Charax el Alquimista necesita unas raras algas de las profundidades del mar.',
  'b1fa84f6': 'La matrona Thuria te ha dicho que la mina de la Casa Attis está encantada.  Atymnius, un minero, sabe detalles de primera mano, pero tarde o temprano tendrás que ir a la mina y hablar con el capataz Amphidamas.',
  '9f0a602a': 'La Maga Libre Prusa dejó Kosha, temerosa de una especie de visión relacionada con el mar, que quizá le ha robado la cordura.  Deberías buscarla para ver si su visión profética puede iluminarte.',
  '0dfb811d': 'Apis, dueño de La Rata de Dos Colas, necesita más harina, y quiere que se la recojas a Periphas, el panadero.',
  '2e408234': 'Apis, dueño de La Rata de Dos Colas, te ha encargado negociar un contrato de vino abierto, siempre que encuentres un viñedo con existencias de sobra.',
  '3c27b89e': 'Los diez Libros de Zafiro de la Sabiduría han desaparecido de la biblioteca del Magisterium.  El bibliotecario Selinus necesita que los encuentres, y a cambio te dará las contraseñas de las salas de los grados superiores.',
  'ef9e2095': 'Nueve de los diez Libros de Zafiro de la Sabiduría han desaparecido de la biblioteca del Magisterium.  El bibliotecario Selinus necesita que los encuentres, y a cambio te dará las contraseñas de las salas de los grados superiores.',
  '86161aa4': 'Ocho de los diez Libros de Zafiro de la Sabiduría han desaparecido de la biblioteca del Magisterium.  El bibliotecario Selinus necesita que los encuentres, y a cambio te dará las contraseñas de las salas de los grados superiores.',
  '9c6b1702': 'Siete de los diez Libros de Zafiro de la Sabiduría han desaparecido de la biblioteca del Magisterium.  El bibliotecario Selinus necesita que los encuentres, y a cambio te dará las contraseñas de las salas de los grados superiores.',
  '47b4ac43': 'Seis de los diez Libros de Zafiro de la Sabiduría han desaparecido de la biblioteca del Magisterium.  El bibliotecario Selinus necesita que los encuentres, y a cambio te dará las contraseñas de las salas de los grados superiores.',
  '0cc3cf55': 'Cinco de los diez Libros de Zafiro de la Sabiduría han desaparecido de la biblioteca del Magisterium.  El bibliotecario Selinus necesita que los encuentres, y a cambio te dará las contraseñas de las salas de los grados superiores.',
  '4a3e368a': 'Cuatro de los diez Libros de Zafiro de la Sabiduría siguen perdidos en algún lugar de Cythera.  Encuéntralos y devuélveselos a Selinus.',
  '9afb7d7b': 'Tres de los diez Libros de Zafiro de la Sabiduría siguen perdidos en algún lugar de Cythera.  Encuéntralos y devuélveselos a Selinus.',
  '6c3eecc9': 'Dos de los diez Libros de Zafiro de la Sabiduría siguen perdidos en algún lugar de Cythera.  Encuéntralos y devuélveselos a Selinus.',
  '5add4f84': 'Uno de los diez Libros de Zafiro de la Sabiduría sigue perdido en algún lugar de Cythera.  Encuéntralo y devuélveselo a Selinus.',
  'b0d9740f': 'Has recuperado los diez Libros de Zafiro de la Sabiduría y se los has devuelto a Selinus.',
  'e6ec461a': 'Pheres, maestro de Curación, necesita que le encuentres y le traigas un huevo de arpía para poder estudiarlo.',
  '4351b2c9': 'El Mago Eioneus ha estado estudiando formas mágicas de mejorar el filo de las armas: quizá, si lo encuentras, pueda ayudarte en tu misión.',
  '0f8ab1e0': 'Alastor el curtidor quiere probar a hacer un par de botas con piel de caimán, y te las dará si le llevas el cadáver de un caimán.',
  '415d0c39': 'A cambio de poder consultar los Libros de Zafiro, has aceptado ayudar a Anisa la historiadora a averiguar quién fue la madre de Alaric.  Lo único que sabes es que quizá vivió en Catamarca antes del 216.',
  '8b9857b3': 'Hadrian, jefe de la guardia de Alaric, necesita que lleves unas flores a la tumba de su madre Andra, fallecida hace poco.  Está enterrada en el cementerio de Catamarca.',
  '8d02d23e': "Thersites, jefe de la guardia de Odemia, ha perdido una reliquia familiar, un anillo con la inscripción 'Para Hapede, con amor'.  Le da demasiada vergüenza pedir ayuda al juez Sacas, así que has aceptado ayudarle tú.",
  'ae5558ff': 'Stentor, antiguo mayordomo del juez Itanos, se dejó una red de pesca en Kosha cuando se marchó.  Has aceptado devolvérsela en Cademia.',
  'eabf405c': 'El kesh, una especie de líquido plateado, quizá tenga que ver con la conspiración contra Alaric.  El juez Sacas quiere que intentes averiguar de dónde viene.',
  'e7ff3cf9': 'Un cambiaformas mató a Opheltius, y Stentor ha dicho que Pelagon es una especie de cambiaformas.  Le has dicho al juez Berossus que hablarás con Stentor para ver si sabe algo más.',
  'd86a6634': 'Aún no se ha encontrado el arma con que mataron a Opheltius: quizá, si la encuentras, puedas ayudar a aclarar el misterio y a limpiar el nombre de Halos.',
  'f7243923': 'Eteocles cree que el arma del crimen acabó tirada en la alcantarilla, y propone buscar a Dryas, la rata de alcantarilla, por si la ha encontrado.',
  '7fbb788a': 'Según su hermano, el Anciano Propontis, Halos de la Casa Strymon quizá sepa más sobre los turbios tratos de la Casa Comana.  Te ha dicho que lo busques en Cademia.',
  'b48b08f3': 'Demodocus el Bardo ha oído el rumor de que la mina de hierro de la Casa Attis está encantada.  Deberías buscar a la matrona Thuria en Cademia para saber más detalles.',
  '234fa271': 'Periphas el panadero te ha dado harina para Apis: llévasela a La Rata de Dos Colas.',
});

/* ---- the books ------------------------------------------------------------ */

// The Sapphire Books follow the sefirot of the Kabbalah, Crown to Kingdom,
// and take the names those have in Spanish.
Object.assign(DELV_TRANSLATION_ES.text, { '021B': {
  'c8412dc3': 'Exploración de las ruinas seldane\n\npor Timon\n Me centro en las ruinas de las afueras de Pnyx, en el nacimiento del río Tirynth, aunque también intentaré relacionar los diversos pilones hallados en distintos lugares remotos, así como los descubrimientos más recientes en la ciénaga al sur de las Llanuras de Khalkis.  Las semejanzas entre los materiales de construcción, así como el estilo arquitectónico, indican con claridad un origen común, aunque se aprecian pequeñas variaciones de estilo que, a mi juicio, tienen más que ver con la finalidad de los edificios que con cualquier otro factor...',
  '01652a4b': 'Alaric, Rey de la Tierra\n El origen de nuestro señor Alaric está envuelto en las profundidades de lo desconocido, pero el pueblo nunca olvidará cuando destruyó el poder del Tercer Tirano en el 216.  Muchos son los relatos de cómo un forastero se presentó en la corte afirmando simplemente que "El gobierno de los Tiranos ha terminado".  El cegador destello de luz que siguió dejó muertos al Tirano y a sus partidarios.\n Entender sus motivos para lo que vino después es más difícil, pues pareció dejar a la sociedad a la deriva, afirmando que solo volvería una vez que se hubiera elegido una forma de gobierno justa.  Pero fue así como seis individuos sentaron las bases de nuestro gobierno actual.',
  '6101c4e6': 'El Artefacto de Pnyx\nEn las ruinas de las afueras de la ciudad de Pnyx se halló un misterioso cristal verde; este cristal ha provocado mucho debate entre los eruditos acerca de los constructores de las ruinas (y de sus poderes).  Esto está claro: es una posible fuente de gran poder, aunque liberar ese poder está fuera del alcance de cuantos lo intentan, lo que convierte este artefacto casi más en una curiosidad que en un hallazgo verdaderamente importante.',
  '1591bd3a': 'Las ruinas seldane de Pnyx\n Cuando el Primer Tirano desterró de Cademia a los primeros magos, estos acabaron por asentarse en la desembocadura del río Tirynth.  Poco después de construir el primer asentamiento, se hallaron unas ruinas antiguas en el nacimiento del río Tirynth.  Sin duda las ruinas no eran obra del hombre, pues los materiales de construcción, por sí solos, escapaban a toda habilidad humana para darles forma.  Por eso a sus constructores se los llamó Metecos, por una raza legendaria que la gente sencilla afirmaba haber visto de vez en cuando.\n ...',
  '8f48fc37': 'Runas seldane de poder\n Se han hallado misteriosas inscripciones en grandes pilones repartidos por toda la tierra, cuyos creadores solo pueden haber sido los Seldane, la antigua raza de los Metecos.  Aún no se ha identificado su significado, pero el análisis de las diversas inscripciones, y de algunas halladas en otras ruinas, ha dado pie a ideas interesantes.\n ...',
  '81c95edb': 'Estudio del flujo temporal\n\nEl Tiempo es como el Mar, en más de un sentido....\n\n...así que propongo que es posible todo un nuevo campo de Magia relacionada con el Tiempo, pero que requiere comprender el poder del Mar, igual que nuestra magia común se basa en la Tierra...',
  '205c0b93': 'Pociones alquímicas básicas\n\nHay varias pociones básicas que el practicante novato puede preparar con equipo y habilidades básicas.  Entre ellas:\nCuración - Azufre\nAmigo del Mago - Obsidiana\nAntídoto - Telarañas\nMente Clara - Menta\nAmigo del Herrero - Rubí\nVista Lejana - Diamantes\nAlimento de los Dioses - Vainas de la ciénaga\nTónico de Nervios - Judías de la ciénaga\n',
  'b795f09e': 'Libro de Zafiro de la Corona\nComo todo puede derivarse de la nada, la Unidad de todo lo que existe es la base de todo lo que existe, y este es el primer paso de lo Infinito a la expresión final.  Este es el primer principio de la conciencia...',
  '80894122': 'Libro de Zafiro de la Sabiduría\nEl primer paso de la creación es la energía o fuerza en bruto, que da la vida.  Es excitación sin causa conocida, cruda y desenfrenada...',
  '6ad4347e': 'Libro de Zafiro del Entendimiento\nSin la capacidad de tomar forma, todo es en vano, así que hay que ser capaz de llevar este razonamiento tan abstracto a los resultados de la energía en bruto de la Sabiduría...',
  '73a59d62': 'Libro de Zafiro de la Misericordia\nEs la creación de la forma el primer paso a través del abismo de lo abstracto a lo concreto, y dentro de esta creación de la forma uno puede experimentar sentimientos de bienestar espiritual...',
  '106cc7d6': 'Libro de Zafiro del Poder\nComo existe la creación de la forma, así debe existir la destrucción de la forma, igual que uno adquiere juicio sobre el bien y el mal y, a través de él, un verdadero entendimiento del poder...',
  '1fee7bec': 'Libro de Zafiro de la Belleza\nLa Belleza es la conciencia de la conciencia, expresada por una perspectiva sobre la vida que es la Belleza.  Es una abstracción entre fuerza y forma...',
  'd0ce2380': 'Libro de Zafiro de la Victoria\nEs la conciencia de la fuerza lo que se necesita para ir más allá de la conciencia abstraída, que puede expresarse como sentimientos sobre las cosas materiales, en esta última abstracción de la fuerza...',
  '917aaf21': 'Libro de Zafiro del Esplendor\nLa última abstracción de la forma, que da la conciencia de la forma.  Uno la experimenta razonando sobre las cosas materiales, lo que obliga a lo que es a tomar forma, sin ser la forma misma...',
  '7fbe4d5d': 'Libro de Zafiro del Fundamento\nEl poder del sueño y la imaginación está a solo un paso del mundo físico, lo que lo convierte en el fundamento de lo que se manifiesta.  Puede verse como la conciencia del mundo....',
  '2f610cc1': 'Libro de Zafiro del Reino\nToda obra se experimenta en último término como sensación física, y por eso la sensación física puede verse como el factor determinante final de las expresiones mágicas.  Es en este mundo físico donde vive el hombre, la materia del mundo...',
  'fe2bb297': 'El gobierno de Alaric, un análisis de Meclemelus\n \n El sistema de gobierno que ha establecido Alaric es de lo más ingenioso, pues ofrece un sistema de controles y contrapesos, siempre que el propio Alaric siga siendo lo que afirma ser: "Rey de la Tierra".  El uso de los Magos es discutible, por la desconfianza general de la gente hacia toda forma de magia, pero como mínimo no es peor que la inquietud de los Tiranos.\n \n El uso de los Magos sí ofrece un sistema de justicia mucho más imparcial, sobre todo porque son neutrales en la política de las Casas y solo deben lealtad a Alaric.  Este autor concede que la magia ofrece un modo de distinguir la verdad de la mentira cuando se aplica a las disputas, así como de impedir el fraude y el abuso en las votaciones familiares.\n \n Hay, sin embargo, dos motivos principales de preocupación.  El primero sería el propio Alaric.  Si no se mantuviera neutral y atento al "bien general" (una expresión risible en sí misma), podría superar a los Tiranos en poder absoluto, sobre todo con los Magos como ejecutores de su voluntad.  Además, si algo le sucediera, el sistema se vendría abajo sin duda, pues sin un líder casi divino en quien el pueblo pueda creer, la desconfianza de la gente decente hacia los Magos llevaría sin duda al colapso.  No obstante, dado lo raro que es que un plebeyo llegue a ver a Alaric, es posible que ya no existiera y que el sistema pudiera continuar solo con la idea de Alaric, convirtiéndolo de verdad en un dios.\n \n El segundo punto son los Magos.  Si dejaran de estar de acuerdo con Alaric y de seguirlo, sobrevendría el caos.  Podrían tomar el control con facilidad.  Por otro lado, si el pueblo perdiera la fe en el poder de los Magos para impartir justicia, el poder de las diversas Casas aumentaría (aunque no está claro que la transición fuera tranquila).\n',
}});

/* ---- the bookshelves ------------------------------------------------------ */

// The Aloiphos volumes quote Crowley in the English Bible's register, so
// they are put in the Spanish of the old Bibles: the second person with its
// capital where it is God's, and the future of the commandment. The clues a
// puzzle turns on ('SGD', 'Th L Dr W') are left exactly as they are.
Object.assign(DELV_TRANSLATION_ES.text, { '021D': {
  '4f533958': 'Cademia, Ciudad Madre\n Cademia no fue solo nuestra primera ciudad: también es la más grande.  Desde el Castillo Imperial hasta el Río, es la fuente de nuestra protección, la fuente de nuestro gobierno.',
  '37bb181b': 'Pnyx, Ciudad del Misterio\n La ciudad de Pnyx es la sede del Magisterium, esa misteriosa escuela de magos que nos da nuestras leyes y nuestra justicia por la gracia de Alaric.  Pero Pnyx es algo más que una escuela, pues guarda libros raros y grandes maravillas.  Construida sobre los principios del saber, es una ciudad maravillosa que visitar.',
  '1e8e3ae7': 'Los baños de Catamarca\n Fundada en el 113 como una sencilla aldea en torno a un manantial, no fue hasta el 174 cuando el Segundo Tirano construyó la Ciudadela.  Levantado sobre un acantilado que albergaba aquel manantial original, este edificio era a la vez una fortaleza y una residencia de recreo para el Segundo Tirano, que buscaba los poderes místicos que, según se decía, había en las aguas del manantial.  Además del Tirano, otros acudían en masa a esas aguas milagrosas, al alcance de todos en las fuentes al pie de la Ciudadela, aunque el acceso al manantial principal estaba reservado al Tirano.',
  '598f38dd': '--Fundamentos de la Magia--\n La magia se basa en los poderes de la propia Tierra, que, manipulados por los poderes de un Mago, pueden obrar maravillas.  El proceso de manipular estos poderes consiste en lanzar un conjuro.\n Una de las herramientas clave de un Mago es su Grimorio, un libro de tablas y fórmulas que sirve no solo para investigar conjuros, sino para estudiar los que ya existen.  Es fundamental para aprender conjuros nuevos, sobre todo a partir de pergaminos, a diferencia de los tomos...\n \n\n...El Camino del Mago empieza como aprendiz, que estudia con un maestro para llegar un día a ser estudiante del Magisterium de Pnyx.\n\n Es como estudiante cuando obtiene su grimorio y aprende sus primeros conjuros.  Bajo miradas atentas, aprende conjuros de los pergaminos usando la información de su grimorio....\n\n Tras el Magisterium, el joven Mago empieza un periodo de servicio público como Juez, usando sus poderes y su saber para arbitrar las disputas de la tierra y ayudar a hacer cumplir las leyes de Alaric.\n\n Si desea ampliar sus poderes, empieza entonces un periodo como Mago Libre, viviendo como un ermitaño para dedicar todo su tiempo al estudio y al saber.\n\n Por último, tras un periodo como Mago Libre, vuelve al Magisterium para demostrar sus poderes y sus habilidades, con la intención de llegar a Maestro.  Una vez Maestro, puede vivir donde quiera, e incluso enseñar en el Magisterium o tomar un aprendiz propio.',
  'bcacf8f7': 'Flora y fauna de Cythera\n La vida salvaje de Cythera es muy diversa para una tierra tan pequeña, pero el entorno va de las montañas a los bosques, de las llanuras a las ciénagas.  Las formas de vida predominantes son hexápodos reptilianos, desde el carroñero más pequeño hasta depredadores mayores que cazan en manada y herbívoros terrestres gigantes.  De ellos, solo el cocodrilo de ciénaga se parece a lo que conocemos, aunque con seis patas.  También hay una versión gigante de un crustáceo parecido al cangrejo.\n Fue una suerte que los colonos pudieran traer algo de ganado y esquejes de plantas, o la vida en Cythera habría sido difícil.  En cambio, las cabras y las gallinas pueden prosperar casi en cualquier parte.  El clima también ha resultado muy adecuado para cultivar uvas y aceitunas, que son la base de la dieta.  Una planta autóctona parecida al lino da tanto harina como fibra para hacer hilo y tela.\n',
  'fff6f738': 'El culto perdido de Scylla\n En los últimos días del Tercer Tirano empezó a surgir un culto clandestino que desafiaba la autoridad del Tirano.  Este culto adoraba a Scylla, el monstruo marino, al que tenía por un dios que gobernaba los mares.  Hasta se decía que el culto incluía sacrificios a las bestias.\n ...\n Por fin, el Tirano envió a su comandante más valiente con una pequeña tropa para destruir el Culto, atacando con sigilo.  El comandante iba armado con la legendaria Espada de los Héroes, el arma más poderosa del Tirano.  Sin embargo, poco después de que salieran de Cademia rumbo al noroeste, apareció Alaric, que puso fin para siempre al gobierno de los Tiranos.\n Del Culto no queda nada, ya sea por la Espada de los Héroes o por los poderes de Alaric, pues la tropa nunca volvió y los poderes del Culto se desvanecieron.  Ni siquiera se conoce el lugar del Templo, salvo que está en el noroeste.',
  'ad7230f5': 'El ciclo vital de Scylla\n No cabe duda de que Scylla es uno de los habitantes más peligrosos de Cythera, pero poco se sabe de estas criaturas...\n ...\n Está claro que Scylla es el macho de la especie, mientras que la hembra rara vez se ve: un terror de muchos brazos conocido como la Hidra.  Aún más raras son las crías de la especie (aunque sobre esto hay cierto debate).  Estos pólipos son formas inmaduras de la especie, con forma de barril y tentáculos en lo alto.  No se han hallado restos intactos de ninguna de estas criaturas, así que mucho seguirá sin saberse, como el modo en que buscan a sus presas (y este autor da fe de la naturaleza violenta de estas criaturas)...',
  'c18e0bfd': 'El asentamiento perdido de Abydos\n Fue en el 184 cuando colonos de Pnyx se aventuraron hacia el sur para fundar un segundo asentamiento, favorable a los magos.  Guiados por el mago Tavara, acabaron fundando el asentamiento de Abydos.\n ...\n Fue en el 192 cuando se perdió todo contacto con Abydos.  Se formó una expedición para restablecer las comunicaciones.  Al entrar en Abydos, descubrieron que todos sus habitantes habían desaparecido, pero sin rastro de violencia.  Había comida en las mesas y herramientas de trabajo en el suelo, como si la gente se hubiera esfumado sin dejar rastro.\n ...\n Hasta el día de hoy se rehúye y se evita Abydos, y se la ha dejado a merced de la naturaleza.  Circulan, eso sí, historias fantasiosas sobre que Abydos está encantada, pero seguro que no hay nada de verdad en ellas.',
  '8fcb81a4': 'Aloiphos A\n ...\n Contemple entonces el Mago cada uno por turno, elevándolo a la potencia  última del Infinito. En la cual el Dolor es Gozo, y el Cambio es Estabilidad, y  la Abnegación es el Yo. Pues el juego de las partes no obra sobre  el todo. Y esta contemplación no se hará por simple  meditación ---¡cuánto menos por la razón!--- sino por el método que  le habrá sido dado a Él en Su iniciación en el Grado.  ...\n',
  'ff8ede2d': 'Aloiphos O\n ...\n Tú me aplastarás en el lagar de Tu amor.  Mi sangre manchará Tus pies de fuego con letanías de Amor en Angustia.\n Habrá una flor nueva en los campos, una cosecha nueva en las viñas.\n Las abejas libarán una miel nueva; los poetas cantarán un canto nuevo.\n ...\n',
  '1d0e88d8': 'Aloiphos V\n ...\n Escribe para aquellos que están preparados. Así se sabe si uno está preparado, si  está dotado de ciertos dones, si es apto por nacimiento, o por  riqueza, o por inteligencia, o por alguna otra señal manifiesta. Y los  servidores del maestro juzgarán de ello por su perspicacia. \n Este Conocimiento no es para todos los hombres; pocos son en verdad los llamados, pero de  esos pocos, muchos son los escogidos. \n Tal es la naturaleza de la Obra.\n ...\n',
  '4fa788ac': 'Aloiphos YS\n ...\n ¡Pues yo soy la suave y sinuosa que se enrosca en torno a ti, corazón de oro!\n Mi cabeza está enjoyada con doce estrellas; Mi cuerpo es blanco como la leche de las estrellas; brilla con el azul del abismo de las estrellas invisibles.\n He hallado lo que no podía hallarse; he hallado un vaso de azogue.\n Tú instruirás a tu siervo en sus caminos; hablarás a menudo con él.\n ...\n',
  'd2be1433': 'Aloiphos YD\n ...\n Asimismo humeará el altar ante el maestro con un incienso que no da humo. Lo que ha de ser negado será negado; lo que ha de ser pisoteado será pisoteado; aquello sobre lo que ha de escupirse será escupido. Estas cosas serán quemadas en el fuego exterior.\n ...\n',
  '9ec4b272': "Aloiphos F\n Muchos se han levantado, siendo sabios.  Han dicho: 'Buscad la Imagen resplandeciente en el lugar siempre dorado, y uníos a Ella.'\n Muchos se han levantado, siendo necios.  Han dicho: 'Inclinaos ante el mundo oscuramente espléndido, y desposaos con esa Ciega Criatura del Limo.'\n Yo, que estoy más allá de la Sabiduría y de la Necedad, me levanto y os digo: ¡consumad ambas bodas!  ¡Uníos a ambas!\n ¡Guardaos, guardaos, os digo, no sea que busquéis la una y perdáis la otra!\n ...\n",
  '5844b75a': 'Aloiphos B\n ...\n Hay cuatro puertas a un mismo palacio; el suelo de ese palacio es de plata  y de oro; hay allí lapislázuli y jaspe; y todos los perfumes raros; jazmín  y rosa, y los emblemas de la muerte. Entre él por turno o a la vez por las  cuatro puertas; póngase en pie sobre el suelo del palacio. ¿No se hundirá?  Amn. ¡Oh, guerrero! ¿Y si tu siervo se hunde? Pero hay medios y medios. Sed  pues de buen parecer: vestíos todos con ropas finas; comed manjares y bebed  vinos dulces y vinos que espuman. ¡Tomad también vuestra parte y vuestro gusto de amor  como queráis, cuando, donde y con quien queráis!\n ...\n',
  '2c8f895a': 'Aloiphos MJ\n ...\n Ahora bien, en esto se conoce el poder mágico.\n Es como el roble que se endurece y resiste a la tormenta.  Está curtido y lleno de cicatrices y seguro de sí como un capitán de navío.\n Asimismo tira como un sabueso de la traílla.\n Tiene orgullo y gran sutileza.  ¡Sí, y también regocijo!\n Obre así el mago en su conjuro.\n Siéntese y conjure; recójase en esa fuerza; álcese luego henchido y en tensión; eche atrás la capucha de su cabeza y clave su ojo de basilisco en el sigilo del demonio.  Mueva entonces su fuerza de acá para allá como un sátiro en silencio, hasta que la Palabra estalle de su garganta.\n No caiga entonces exhausto, aunque la fuerza haya sido diez mil veces la humana; pues lo que lo inunda es la misericordia infinita del Genitor-Genetrix del Universo, del cual él es el Vaso.\n ...\n',
  'ce36cc3a': 'Aloiphos YH\n ...\n El Habla en el Silencio.\n Las Palabras contra el Hijo de la Noche.\n La Voz de Tahuti en el Universo en Presencia del Eterno.\n Las Fórmulas del Conocimiento.\n La Sabiduría del Aliento.\n La Raíz de la Vibración.\n El Estremecimiento de lo Invisible.\n El Desgarrarse de la Tiniebla.\n El Hacerse Visible de la Materia.\n El Traspasar de las Escamas del Cocodrilo.\n ¡El Irrumpir de la Luz!\n ...\n',
  'd44e805a': "Aloiphos FD\n ...\n Busca después los Testigos y el Juez en su  tabla especial, y mira lo que se dice bajo el epígrafe de la pregunta.  Anótalo.   Observa luego qué figura cae en la Casa requerida (si salta a otras  Casas, también estas deben considerarse); 'p. ej.', en una pregunta sobre dinero  robado, si la figura de la segunda está también en la sexta podría indicar que el ladrón es un  criado de la casa.  Busca luego en la Tabla de las Figuras en las Casas, y  mira qué significa la figura en la Casa concreta que se considera...\n",
  'e8eeeb72': 'Aloiphos MRS\n ...\n Retorciéndose y rugiendo por un eón sin edad,\n Envolviendo el mundo, desdeñando el empíreo,\n Ahogando con su oscura y despótica inminencia\n Toda vida y toda luz, aniquilando el sentido --\n He estado sellado y en silencio en el vientre\n De la nada para brotar, audaz flor de criatura,\n En el éter superior de tus ojos.\n ¡Oh! una grave mirada enciende el Paraíso,\n Un destello me sienta en el trono de lo alto,\n Mi orbe el mundo.\n ...\n',
  '181bcf54': 'Aloiphos VA\n ...\n Guárdese el Aspirante del más leve ejercicio de su voluntad contra otro ser.  Así, estar tendido es mejor postura que estar sentado o de pie, pues opone menos resistencia a la gravedad.  Con todo, su primer deber es para con la fuerza más cercana y más potente; p. ej., puede levantarse para saludar a un amigo.\n\n Esta es la tercera práctica de la Ética.\n Ejerza el Aspirante su voluntad sin la menor consideración hacia ningún otro ser.  Esta indicación no puede comprenderse, y mucho menos cumplirse, hasta que se haya perfeccionado la práctica anterior.\n\n Esta es la cuarta práctica de la Ética.\n ...\n',
  'f1babc3f': 'Aloiphos VD\n ...\n Primer Punto.  El estudiante debe descubrir primero por sí mismo la posición aparente del punto de su cerebro donde surgen los pensamientos, si es que existe tal punto.\n\n Si no, debe buscar la posición del punto donde se juzgan los pensamientos.\n\n Segundo Punto.  Debe también desarrollar en sí mismo una Voluntad de Destrucción, aun una Voluntad de Aniquilación.  Puede que esta se descubra a una distancia inconmensurable de su cuerpo físico.  Aun así, a ella ha de llegar, con ella ha de identificarse hasta perderse a sí mismo.\n\n Tercer Punto.  Vigile entonces esta Voluntad atentamente el punto donde surgen los pensamientos, o el punto donde se juzgan, y sea aniquilado todo pensamiento en cuanto se perciba o se juzgue. ...\n',
  '1eb18569': 'Aloiphos YA\n ...\n En el principio era la Iniciación.  La carne de nada aprovecha; la mente de nada aprovecha; aquello que os es desconocido y está por encima de ellas, aun asentado firmemente en su equilibrio, da la vida.\n\n En todo sistema ha de hallarse un sistema de Iniciación, que puede definirse como el proceso por el cual un hombre llega a conocer esa Corona desconocida.\n ...\n',
  '9a9df002': 'Aloiphos J\n ...\n La rana,  una vez  atrapada,  se guarda toda  la noche en  un arca o  cofre. Al poco la rana empezará a  saltar dentro, y  esto es presagio  de buen éxito.  Llegada el alba,  te acercarás  al cofre con  una ofrenda  de oro,  y si lo hubiere, de incienso  y de mirra. Liberarás entonces  a la rana del cofre con muchos actos de  homenaje y la pondrás en aparente libertad. Puede, por ejemplo,  ponérsela sobre una colcha  de muchos colores,  y cubrírsela con una red. ...\n',
  '56b770cc': "Crónica de Semius el Cazador de Gólems\n ...\n Y en estos días, dados los problemas de los gólems que sobreviven a la muerte de su amo, hay que darles caza y destruirlos, no sea que causen estragos y traigan mayores daños a la población entera, y con ello desconfianza hacia los propios magos.\n ...\n Semius partió, con la legendaria capa del héroe Herakles, a dar muerte a estas amenazas para la sociedad, a reducirlas a la carne de la tierra.\n ...\n Y así, el destino de Semius es desconocido; el último rumor lo situaba en la ciudad de Cademia, aunque no es más que un rumor.  Se dice que la última vez que lo vieron estaba comprando una lira, y que dijo algo de que 'la clave para abrir es SGD', aunque nosotros, por supuesto, lo tenemos por un disparate.\n",
  '1fa0147d': "Informe sobre los Jefes Ocultos y el Culto de Scylla\n Diones el Anciano, 203 D.T. \n La información de este escrito se considera reservada.\n \n Todo el asunto del Culto de Scylla tiene graves consecuencias para nuestra existencia futura.  Aunque el Culto ha resultado ser una fuente de problemas para nuestro enemigo, el Tirano, puede suponer una amenaza igual para nosotros.  Aunque al principio parece una simple religión popular, parece haber una inteligencia detrás, a la que hemos llamado 'Jefes Ocultos'.  Quiénes son y cuál es la fuente de su poder, aún no lo hemos determinado, pero pasar desapercibidos tanto para nosotros como para los agentes del Tirano exige dones que van más allá de lo esperado.\n \n Nuestro agente ha determinado que solo el círculo más íntimo del Culto conoce a estos Jefes Ocultos, y no ha podido obtener más información que su existencia.  Que aquí interviene un poder que está más allá de nuestra magia es un hecho.  Nuestras mejores videncias solo han determinado que hay alguna relación con la perdida Abydos, pero incluso eso lo oscurece algo que está más allá de nuestra magia.\n \n Investigaré este asunto personalmente, e informaré cuando se sepa más.",
  'f921212b': "===Bestiario de Asilops, Bestias comunes===\n La flora y la fauna de Cythera son ricas y variadas.  Hay, sin embargo, varias criaturas comunes importantes que uno puede ver en las tierras salvajes de Cythera (téngase en cuenta que este volumen no trata de las bestias domésticas).\n \n Caimanes de ciénaga - Estas feroces bestias abundan en las Ciénagas del Sur, aunque a veces pueden verse en terrenos pantanosos y en las orillas de los ríos.  Son rápidos y mortíferos, pero no muy listos.\n \n Áspides - Otro morador de las Ciénagas del Sur, estas criaturas también se encuentran en otras partes de las tierras salvajes.  Aunque normalmente suponen poca amenaza para el viajero, se sabe que su mordedura es venenosa. \n Ratlagartos - Este pequeño lagarto se encuentra en todas partes del mundo, incluidas las alcantarillas de Cademia.  Lo que les falta de tamaño, sin embargo, lo suplen a menudo con su número, y se sabe que atacan en enjambre.\n \n Lobolagartos - Primo mayor del ratlagarto, el lobolagarto se encuentra en manadas más grandes.  También es más peligroso que el ratlagarto, y por eso se aconseja al viajero no atravesar de noche los bosques del mundo, pues son su hábitat más común.  También se sospecha que de día tienen guaridas en cuevas.\n \n Unicornio - El enorme reptil de seis patas y un solo cuerno es común en las tierras salvajes de Cythera.  Pese a su aspecto, suele ser bastante inofensivo si se lo contempla de lejos.  Se aconseja al viajero dejar en paz a estos colosos.\n \n Titán - Con su largo cuello y su gran altura, estas elegantes criaturas suelen alimentarse de los árboles más altos de los bosques.  Como el unicornio, son relativamente inofensivos si se los deja en paz y a distancia.",
  '4402285d': "===Bestiario de Asilops, Bestias poco comunes===\n Muchos son los animales raros y extraños de las tierras salvajes de Cythera (véase el volumen 'Bestias comunes' para más detalles).  Más extrañas todavía, sin embargo, son las criaturas que rara vez se ven en las tierras salvajes y que se encuentran, en cambio, en otros terrenos.\n \n Cangrejo gigante - Como su primo más pequeño (y sabroso), el cangrejo gigante suele encontrarse cerca del océano, en las diversas costas de Cythera.  Le gustan especialmente las cuevas y cavernas cercanas a esas costas.  Estas criaturas, sin embargo, ni son comestibles ni tan inofensivas como su primo pequeño.  Al contrario, son agresivas y peligrosas, sobre todo por su duro exoesqueleto.\n \n Légamo - Este limo gris se encuentra en diversas cuevas y cavernas de Cythera.  Aunque no parece peligroso, en realidad es venenoso.  Se rumorea, sin embargo, que es muy vulnerable al fuego.\n \n Medusa terrestre - Como el légamo, estas criaturas se encuentran en cuevas y cavernas.  También como el légamo son venenosas, pero además saben nadar.  En lo demás, hay que tratarlas como al légamo.\n \n Babosa gigante - Si alguna vez hubo una criatura de aspecto más repugnante, costaría encontrarla.  Este enorme saco de podredumbre andante, de color enfermizo, suele encontrarse solo en las cuevas y cavernas de la tierra, alimentándose de criaturas muertas y no tan muertas.  Por suerte, es relativamente inofensiva, además de fácil de matar.\n \n Scylla - En el mar no hay criatura más temida que Scylla, el monstruo marino.  Lo único que suele verse es su enorme cabeza sobre el agua, y sus tentáculos (aunque a veces solo se ven los tentáculos).  No se han hallado restos de esta criatura, así que se supone que los tentáculos y la enorme cabeza son una misma criatura.  Scylla es la principal razón por la que los antepasados de Cythera tuvieron que renunciar a su antigua vida marinera.\n ",
  'c4dcdfb6': "===Bestiario de Asilops, Bestias legendarias===\n Hay bestias extrañas y exóticas de sobra en Cythera (véanse mis dos volúmenes anteriores, 'Bestias comunes' y 'Bestias poco comunes') sin necesidad de inventar criaturas nuevas; este autor no ha tenido experiencia personal con ninguna de estas criaturas, así que se admite cierta duda sobre su existencia.  Aun así, mi obra no puede estar completa sin mencionar al menos algunas de ellas.\n \n Pólipo - Criatura verde con forma de barril, con una sola boca como un pico en lo alto y repugnantes tentáculos alrededor de la parte superior del cuerpo; puede que esté emparentada con Scylla (por su parecido aspecto tentacular).  Se supone que son muy agresivos y peligrosos.\n \n Hidra - Quizá una versión mayor del pólipo, o quizá otra especie completamente distinta, esta enorme criatura es todo lo malo del pólipo multiplicado por diez.  Aunque quisiera dudar de su existencia, ha habido demasiados informes para descartarla tan fácilmente.  Aun así, nunca se han hallado restos.\n \n Duende de fuego - Esta criatura legendaria parece ser una especie de llama viva.  Sin duda no es más que otro cuento de viajeros, con poco que respalde su existencia.\n \n Arpía - Se ha informado de extrañas criaturas voladoras, de color cadavérico, que viven en algún lugar del extremo suroeste de la tierra.  Con una cola como un látigo y alas gomosas, esta criatura quizá estaría más en su elemento en el mar que en el aire.  Se rumorea que su mordedura, o su cola, es venenosa.\n \n Sílfide - Esta bola de luz flotante y palpitante la han visto a veces los viajeros de noche, solo para desvanecerse cuando uno se acerca.  Quizá nunca se descubra el verdadero origen de este fenómeno.\n \n Metecos - Las criaturas legendarias que construyeron algunas de las ruinas de Cythera; estas criaturas pertenecen por entero al reino de la leyenda.  Se dice que son altas, de piel gris y cabello verde, y todavía se rumorea que viven en partes remotas de Cythera, contemplando quién sabe qué.\n \n Ondinas - Algunos pescadores dicen haber visto criaturas de aspecto humano jugando entre las olas a una gr\"\n",
  '70d34b6a': "===Bestiario de Asilops, Bestias mágicas===\n Aunque creí completo mi bestiario con mi volumen anterior, 'Bestias legendarias', es evidente que se me han escapado las criaturas creadas por medios mágicos.  Debe señalarse que no he tenido experiencia personal con ninguna de las entradas que aquí se recogen; todas se han reunido conversando con diversos Magos.\n \n Gólem - Esta criatura es la insensatez de los Magos.  Se creó como sirviente: tierra animada por magia.  Por desgracia, la criatura seguía existiendo incluso después de la muerte de su amo.  Sin amo, se volvían peligrosos para todo lo que los rodeaba, lo que dio origen al oficio de 'Cazador de Gólems'.  Por suerte, ya no hace falta tal profesión, y los magos saben ahora que no deben crear conjuros tan abiertos.\n \n No muertos y esqueletos - Mediante una forma de magia de lo más malvada, los cuerpos muertos de los humanos pueden transformarse en sirvientes andantes.  Hay que subrayar que esta forma de magia no se enseña y, en verdad, de no ser por testigos muy fiables, ni siquiera debería ser posible usar la magia de este modo.\n \n Liche - Si uno aplicara el proceso de crear un sirviente no muerto al cuerpo vivo del propio lanzador, se teoriza que el procedimiento crearía una abominación malvada.  De nuevo, debe señalarse que esta criatura es de naturaleza puramente teórica; el autor cree que los Magos han especulado sobre ella para explicar la posible existencia de sirvientes no muertos.\n \n Demonios - A falta de un término mejor, sería una entidad mágica invocada, un egrégor creado solo de esencia mágica.  De nuevo, es una criatura teórica, postulada como un experimento para crear un sirviente como un gólem, pero sin los 'problemas' asociados a este.",
  '30990edf': 'Tercera Profecía de Neleneus el Sabio\n \n...\n Y al Final de la Segunda Era, el Gran Unificador partirá.\n Con esta partida vendrán el caos y el desastre.\n \n La Tierra y el Mar se separarán, el centro no podrá sostenerse.\n El Aire y el Fuego causarán estragos, y caerá la Noche.\n \n De la Noche al Alba Siguiente, lo que era Uno se volverá Muchos.\n El Pájaro de Dos lamentará su suerte, y la del Tercero.\n \n El Mundo será desgarrado antes de la Llegada del Alba.\n Y roto quedará para siempre.\n \n El vacío no guardará las partes del Todo,\n Pues los poderes de las Cuatro Direcciones formarán una Quinta.\n \n Las Cuatro partes del Abridor de Caminos, Hechas Una,\n Esta será la Llave del Quinto Elemento.\n \n Quienes caminen el Quinto Elemento Traerán el Alba.\n Y de esos Caminantes nacerá un Nuevo Orden.\n \n Solo los Caminantes del Nuevo Orden tendrán el Poder Unificado,\n Y los de las Cuatro Direcciones quedarán a su merced.\n ',
  '546e498f': 'Segunda Profecía de Neleneus el Sabio\n \n...\n Conoceréis las Señales de la Llegada del Segundo Fin.\n Serán la plaga, la violencia y la traición.\n \n Los Traidores serán guiados, como lo fueron antes los Ocultos.\n Los Traidores, sin embargo, no fracasarán como los Ocultos.\n \n Buscad, pues, los Cinco Presagios,\n Prueba del Fin de la Era.\n \n Los hijos matarán a los padres, en un juego de Poder.\n Así es el primer Presagio.\n \n Los Mares se alzarán, y los Muertos caminarán.\n Este es el segundo Presagio.\n \n Un Forastero vendrá, y con él las Pesadillas.\n Este es el tercer Presagio.\n \n Los Ocultos uniéndose a los Traidores, para vencer al Amo.\n Este es el cuarto Presagio.\n \n Lo que fue partido en cuatro será unido, Abridor de Caminos.\n Este es el quinto Presagio.\n \n Contra estos cinco Presagios, nadie puede resistir.\n Y así pasará la Era del Unificador.\n ',
  'f914ec35': 'Primera Profecía de Neleneus el Sabio\n \n...\n Los días de los Tiranos están contados,\n Y acabarán con un nuevo orden.\n \n Los desterrados volverán,\n Y con ellos, un nuevo líder.\n \n El pueblo se alegrará,\n Y Seis de ellos se alzarán.\n \n Cuando hable la Voz de un Dios,\n Así será la primera señal.\n \n Lo que se Perdió intentará volver,\n Pero no es ahora el momento de que así sea.\n \n La Voz debe ser destruida,\n Pues no dice la verdad.\n \n Así será el último acto del Tirano,\n Antes de que llegue el Errante.\n \n Con la guía de un bufón,\n Así comenzará una nueva Era.\n',
  '3ca8ae69': '===Historia de Kythera===\n La historia de Kythera se remonta a la destrucción de nuestra patria por el fuego y a nuestro heroico viaje por el mar.  Cómo despertamos, perdidos y varados, en una isla desconocida a la que hemos acabado llamando Kythera es sin duda materia de leyendas.\n La pérdida de nuestros dioses fue para nosotros una desgracia, y el ascenso de los Magos habría sido el desastre para todos, de no ser por el poder del Gran Tirano de Cademia, que los desterró en el 152.  En verdad, sin el Gran Tirano jamás habríamos sobrevivido.\n',
  'f0d95f24': "Una traducción del Manuscrito Cifrado\n Entre la multitud de Realidades está el Vacío.  Poder cruzar el Vacío es poder cruzar entre Realidades.  Que los de la Quimera lo han hecho se da por hecho, y de ellos he aprendido esa capacidad.  Las Realidades pueden ser tan pequeñas como Kythera, o un Universo entero, completo en sí mismo, como lo era la patria de los humanos.  Todas, sin embargo, las crean como Quimera.  Kythera parece única en la debilidad entre la Barrera y el Vacío: las fuerzas Elementales son fuertes para mantener la cohesión, o eso me dijeron.  Yo, sin embargo, sostengo que la lucha entre ellas ha permitido que esta Barrera se debilite; si se deja que continúe, será destruida, y con ella Kythera.  Hay que prepararse para ambos futuros: tanto intentando realinear las fuerzas Elementales como aumentando la localización de la Barrera, por si Kythera se fragmentara.  Si ocurriera esto último, la onda expansiva bien podría trastornar también las Realidades cercanas; los de la Quimera no lo saben con certeza, pero así me han advertido.  En esa advertencia no pude evitar percibir un pensamiento, 'Th L Dr W', aunque no sé qué significan esas letras.\n \n Para unificar los Cuatro Pilares he traído a los humanos, que son del Quinto Elemento, aunque su llegada ha alterado buena parte del equilibrio.  Si es que para empezar había equilibrio.  Otra herramienta, si se reúne, podría ayudar: los fragmentos de la Piedra de la Perdición.  Esos fragmentos, sin embargo, están fuera de mi alcance en esta coyuntura.  Conseguirlos será una apuesta peligrosa, que solo emprenderé si parece que todo lo demás está fallando (pues esa apuesta, si fallara, bien podría apresurar el final que más se teme).",
  '67ca30b1': 'Historia del Manuscrito Cifrado\n \n\nEn el 186 D.T. se hallaron los restos de un manuscrito chamuscado en el fondo de un cofre de la biblioteca de Pnyx.  No solo se hallaron únicamente fragmentos, sino que estaban escritos en una escritura desconocida.  Con un trabajo minucioso se intentó recrear el documento original.  El resultado, sin embargo, es en el mejor de los casos muy confuso. \n \nLos problemas son múltiples: no conocemos la escritura original, ni las palabras, ni la gramática.  Mediante métodos mágicos experimentales, que por desgracia más a menudo destruían el original que lo traducían, seguimos adelante.  Lo que descubrimos, no podíamos haberlo previsto. \n \nEl revoltijo resultante de ideas y frases se reordenó después, intentando crear un documento utilizable.  Nos hemos tomado ciertas libertades para intentar organizar las ideas que contiene en una forma más legible.  Hemos hecho nuestra mejor conjetura con algunas de las palabras desconocidas; esperamos que esto no cambie el contenido de manera significativa.  Si hay algo de verdad en este documento, sería de lo más alarmante.  Y no lo menos alarmante es la cuestión del autor del documento, que casi con certeza no es humano...\n \n ',
  '5f956106': 'Diario de Tavara\n \n La caída del Templo Exterior ha causado mucha preocupación entre las Ondinas, y la situación empeora con el ascenso de ese Alaric.  Intuimos la mano de los Seldane en esto de algún modo, pero Alaric está tan por encima de nosotros como nosotros de los Magos.  Aun así, el tiempo está de nuestra parte, pues Alaric no deja de ser un mortal. \n \n Debo confesar, sin embargo, que mi fe en las Ondinas ha flaqueado.  Aunque es cierto que han sido aliadas fieles y me han concedido mucho poder, tengo mis dudas.  Primero fue el Manuscrito Cifrado, luego la caída del T.E., y ahora Alaric.  No son tan todopoderosas como quieren hacer creer, a pesar de haber derrocado a los Seldane.  Sencillamente parecen incapaces de manejar el pensamiento temporal de los mortales; quizá algún día pueda aprovechar eso en mi favor.  Me tomaron por tonto cuando destruimos Abydos, y me vengaré por ello...',
  'c6a1c576': 'El Laberinto de la Iniciación\n \n Solo a través de pruebas y ordalías puede un aspirante ser iniciado de verdad en los misterios de Scylla.  El candidato debe, por tanto, atravesar el Laberinto de la Iniciación.  Solo esto pondrá a prueba si el candidato es digno.\n \n Primero, el candidato debe encontrar el secreto, pues solo mediante el conocimiento secreto se abre el camino del crecimiento futuro. \n\n La segunda prueba es una prueba de poder, pues solo mediante la fuerza puede abrirse la puerta de la realidad.  Si vacila, o yerra en el uso del poder, sin duda ese poder lo destruirá. \n\n La tercera prueba es de planificación.  Solo planificando bien pueden apartarse los obstáculos de la vida, y revelarse el medio de abrir la cámara más interior. \n\n Por último, hay que dominar el verdadero laberinto de la comprensión.  Aunque los caminos de la vida cambian y se alternan sin cesar, mediante la comprensión puede dominarse este laberinto. \n\n Una vez que el candidato ha superado estas cuatro pruebas, puede ser de verdad miembro del Templo.',
}});
