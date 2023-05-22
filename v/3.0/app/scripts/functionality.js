// @ts-nocheck

class Muzzy {

    static QUOTE = "{muzzy-quote}";

    static types = {
        MLA: "MLA Format",
        FORMALITY: "Formality",
        DEPTH: "Depth",
        AWARENESS: "Awareness",
        SPELLING: "Spelling",
        get descriptions() {
            return {
                [Muzzy.types.MLA]: "Violations of MLA rules and recommendations.",
                [Muzzy.types.FORMALITY]: "Informal/unprofessional wording, phrasing, or punctuation.",
                [Muzzy.types.DEPTH]: "Wording or phrasing that significantly lacks depth.",
                [Muzzy.types.AWARENESS]: 'Errors involving an essay directly referencing itself, the "book", or the "characters."',
                [Muzzy.types.SPELLING]: "Erroneously written words and phrases."
            }
        }
    };

    static lib = {
        typojs: new (require("typo-js"))("en_US", MuzzyTypoDependencies.AFF, MuzzyTypoDependencies.DIC),
        writegood: {
            api: require("write-good"),
            whitelist: [ "read-only" ],
            passive: text => Muzzy.lib.writegood.api(text, { passive: true, illusion: false, so: false, thereIs: false, weasel: false, adverb: false, tooWordy: false, cliches: false, eprime: false, whitelist: Muzzy.lib.writegood.whitelist }),
            weasel: text => Muzzy.lib.writegood.api(text, { passive: false, illusion: false, so: false, thereIs: false, weasel: true, adverb: true, tooWordy: false, cliches: false, eprime: false, whitelist: Muzzy.lib.writegood.whitelist }),
            wordy: text => Muzzy.lib.writegood.api(text, { passive: false, illusion: true, so: true, thereIs: true, weasel: false, adverb: false, tooWordy: true, cliches: false, eprime: false, whitelist: Muzzy.lib.writegood.whitelist }),
        },
        tense: muzzyTense
    }

    static editor = null;

    static Database = {
        init() {
            if (localStorage.getItem("muzzy")) return;
            localStorage.setItem("muzzy", JSON.stringify({}));
        },

        get(key, def=null) {
            Muzzy.Database.init();
            const db = JSON.parse(localStorage.getItem("muzzy"));
            if (key) return db[key] ?? def;
            else return db;
        },

        edit(callback) {
            const db = Muzzy.Database.get();
            const result = callback(db) || db;
            localStorage.setItem("muzzy", JSON.stringify(result));
        },

        set(key, value) {
            Muzzy.Database.edit(db => {
                db[key] = value;
            });
        },

        delete(key) {
            Muzzy.Database.edit(db => {
                if (db[key]) delete db[key];
            });
        },

        clear() {
            Muzzy.Database.init();
            localStorage.removeItem("muzzy");
        }
    }

    static References = class MuzzyBibliography {
        static #list = [
            /* Example structure:
            {
                firstName: "John",
                lastName: "Doe",
                title: "The Art of Art",
                url: null
            }
            */
        ];

        static get(lastName, firstName=null) {
            if (!lastName) return this.#list;
            return this.#list.find(r => r.lastName == lastName && (firstName == null || r.firstName == firstName));
        }

        static get authorRegexes() {
            return this.#list.map(ref => (
                `\\b(?:${ref.firstName}[ ]+${ref.lastName})\\b`
            ));
        }

        static isTitle(title) {
            return this.#list.some(ref => ref.title == title);
        }
    }

    static Errors = class MuzzyErrors {

        static checksEnabled = true;
        static currentErrors = [];

        static list = {
            TENSE: { // Past/future tense checker
                name: "Verb Tense",
                description: "Formal essays should be written in present tense.",
                example: "John went to the mall in search of candy. >>> John goes to the mall in search of candy.",
                type: Muzzy.types.MLA,
                handler: (text, quotes, fullText) => {
                    const wordSplitter = [{
                        index: -1
                    }].concat(Muzzy.Errors.getIndexes(text, /[ ]+/g, quotes));
                    const results = [];

                    for (let i = 0; i < wordSplitter.length; i++) {
                        const wordLength = (wordSplitter[i+1]?.index ?? fullText.length - 1) - wordSplitter[i].index - 1;
                        const wordIndex = {
                            index: wordSplitter[i].index + 1,
                            length: wordLength
                        };

                        const word = fullText.substring(wordIndex.index, wordIndex.index + wordIndex.length);
                        if (word.match(/["]|[0-9]/g)) continue;
                        wordIndex.length = word.replace(/[^a-z']+$/gi, "").length;

                        if (Muzzy.lib.tense.isPast(word.replace(/[^a-z]/gi, ""))) results.push(wordIndex);
                    }

                    return results;
                }
            },
            WORD_CHOICE: { // Use weasel word function of write-good, with additional check for "like"
                name: "Word Choice",
                description: 'Words such as "thing" and "very" are weak or potentially meaningless choices, often referred to as weasel words.',
                example: "The pastor is very worried about something. >>> The pastor is increasingly worried about the hole in the roof.",
                type: Muzzy.types.DEPTH,
                handler: (text, quotes) => {
                    const indexes = Muzzy.lib.writegood.weasel(text).map(res => {
                        return {
                            index: Muzzy.Errors.__getTrueIndex(res.index, text, quotes),
                            length: res.offset
                        };
                    });

                    const regex = /\b(?:thing)\b/gi;
                    return Muzzy.Errors.getIndexes(text, regex, quotes).concat(indexes);
                }
            },
            CAPITALIZE: { // Check for lowercase days of week, languages, months
                name: "Capitalization",
                description: "Names, proper nouns, days of the week, languages, months, and beginnings of sentences should be capitalized.",
                example: "samantha realizes it is monday. >>> Samantha realizes it is Monday.",
                type: Muzzy.types.FORMALITY,
                handler: (text, quotes) => {
                    const nounRegex = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|april|june|july|august|september|october|november|december|english|spanish|french|italian|portuguese|chinese|hindi|russian|german|japanese|korean|finnish|swedish|norwegian|tagalog|tamil|urdu|nepalese|latin|sanskrit|ukrainian|british|canadian|mexican|american|brazilian|indian|australian|african|indonesian|vietnamese|cambodian|argentinian|chilean|turkish|arabic|arabian|arab|egyptian|icelandic|dutch|polish|danish|bengali|czech|greek|roman|hebrew|romanian|catalan|hungarian|bulgarian|javanese|telugu|marathi|punjabi|gujarati|persian|iranian|afghan|pakistani|saudi|yemeni|qatari|bahraini|asian|european|eurasian|nigerian|greenlandic)\b/g;
                    const nounIndexes = Muzzy.Errors.getIndexes(text, nounRegex, quotes);

                    const sentenceRegex = XRegExp("(?<=^|\\.\\s+)[a-z][^\\s]*", "g");
                    const sentenceIndexes = Muzzy.Errors.getIndexes(text, sentenceRegex, quotes);
                    
                    return nounIndexes.concat(sentenceIndexes);
                }
            },
            PERSONAL_PRONOUNS: { // Check for personal pronouns
                name: "Personal Pronouns",
                description: "Avoid references to yourself or the reader of your essay.",
                example: "I believe that Mondays are terrible. >>> Mondays are terrible.",
                type: Muzzy.types.MLA,
                handler: (text, quotes) => {
                    const regex = /\b(?:me|myself|I|my|mine|you|yourself|yourselves|your|yours|we|us|our|ours|ourselves|ourself)\b/gi;
                    return Muzzy.Errors.getIndexes(text, regex, quotes);
                }
            },
            WEAK_TRANSITIONS: { // Check for first, second, third, final, firstly, secondly, thirdly, finally, in conclusion
                name: "Weak Transitions",
                description: 'Words such as "first" and "finally" are elementary-level transitions.',
                example: "First, Jane runs to the market. >>> Aiming to avoid the afternoon crowd, Jane runs to the market.",
                type: Muzzy.types.DEPTH,
                handler: (text, quotes) => {
                    const regex = /\b(?:First|Second|Third|Final|Firstly|Secondly|Thirdly|Finally|Last|Lastly|In\sconclusion)(?:[ ]+of[ ]+all|)(?=,)/g;
                    return Muzzy.Errors.getIndexes(text, regex, quotes);
                }
            },
            LAST_NAME: { // Check for two capitalized words next to each other (but not at beginning of sentence). If these two words both occur next to each other again, trigger this
                name: "Naming Convention",
                description: "When a person or character is first introduced, use their full name. Afterwards, only use their last name, unless multiple characters share the same last name.",
                example: "In Tolstoy's <i>War and Peace</i>, an avocado evaporates. Leo should write a sequel. >>> In Leo Tolstoy's <i>War and Peace</i>, an avocado evaporates. Tolstoy should write a sequel.",
                type: Muzzy.types.MLA,
                handler: (text, quotes) => {
                    let indexes = [];

                    Muzzy.References.authorRegexes.forEach(regex => {
                        const authorIndexes = Muzzy.Errors.getIndexes(text, regex, quotes);
                        authorIndexes.shift();

                        indexes = indexes.concat(authorIndexes);
                    });

                    return indexes;
                }
            },
            DICTION_INFORMAL: { // Cliche checker
                name: "Informal Phrases",
                description: "Avoid using slang or clich&eacute;s, they are very informal and unoriginal.",
                example: "Writing ain't dope, my man. It's like a bull in a china shop. >>> Writing is terrible, not unlike drone strikes.",
                type: Muzzy.types.FORMALITY,
                handler: (text, quotes) => {
                    let cliches = ["a chip off the old block","a clean slate","a dark and stormy night","a far cry","a fine kettle of fish","a loose cannon","a penny saved is a penny earned","a tough row to hoe","a word to the wise","ace in the hole","acid test","add insult to injury","against all odds","air your dirty laundry","all fun and games","all in a day's work","all talk, no action","all thumbs","all your eggs in one basket","all's fair in love and war","all's well that ends well","almighty dollar","American as apple pie","an axe to grind","another day, another dollar","armed to the teeth","as luck would have it","as old as time","as the crow flies","at loose ends","at my wits end","avoid like the plague","babe in the woods","back against the wall","back in the saddle","back to square one","back to the drawing board","bad to the bone","badge of honor","bald faced liar","ballpark figure","banging your head against a brick wall","baptism by fire","barking up the wrong tree","bat out of hell","be all and end all","beat a dead horse","beat around the bush","been there, done that","beggars cannot be choosers","behind the eight ball","bend over backwards","benefit of the doubt","bent out of shape","best thing since sliced bread","bet your bottom dollar","better half","better late than never","better mousetrap","better safe than sorry","between a rock and a hard place","beyond the pale","bide your time","big as life","big cheese","big fish in a small pond","big man on campus","bigger they are the harder they fall","bird in the hand","bird's eye view","birds and the bees","birds of a feather flock together","bit the hand that feeds you","bite the bullet","bite the dust","bitten off more than he can chew","black as coal","black as pitch","black as the ace of spades","blast from the past","bleeding heart","blessing in disguise","blind ambition","blind as a bat","blind leading the blind","blood is thicker than water","blood sweat and tears","blow off steam","blow your own horn","blushing bride","boils down to","bolt from the blue","bone to pick","bored stiff","bored to tears","bottomless pit","boys will be boys","bright and early","brings home the bacon","broad across the beam","broken record","brought back to reality","bull by the horns","bull in a china shop","burn the midnight oil","burning question","burning the candle at both ends","burst your bubble","bury the hatchet","busy as a bee","by hook or by crook","call a spade a spade","called onto the carpet","calm before the storm","can of worms","cannot cut the mustard","cannot hold a candle to","case of mistaken identity","cat got your tongue","cat's meow","caught in the crossfire","caught red-handed","checkered past","chomping at the bit","cleanliness is next to godliness","clear as a bell","clear as mud","close to the vest","cock and bull story","cold shoulder","come hell or high water","cool as a cucumber","cool, calm, and collected","cost a king's ransom","count your blessings","crack of dawn","crash course","creature comforts","cross that bridge when you come to it","crushing blow","cry like a baby","cry me a river","cry over spilt milk","crystal clear","curiosity killed the cat","cut and dried","cut through the red tape","cut to the chase","cute as a bugs ear","cute as a button","cute as a puppy","cuts to the quick","dark before the dawn","day in, day out","dead as a doornail","devil is in the details","dime a dozen","divide and conquer","dog and pony show","dog days","dog eat dog","dog tired","do not burn your bridges","do not count your chickens","do not look a gift horse in the mouth","do not rock the boat","do not step on anyone's toes","do not take any wooden nickels","down and out","down at the heels","down in the dumps","down the hatch","down to earth","draw the line","dressed to kill","dressed to the nines","drives me up the wall","dull as dishwater","dyed in the wool","eagle eye","ear to the ground","early bird catches the worm","easier said than done","easy as pie","eat your heart out","eat your words","eleventh hour","even the playing field","every dog has its day","every fiber of my being","everything but the kitchen sink","eye for an eye","face the music","facts of life","fair weather friend","fall by the wayside","fan the flames","feast or famine","feather your nest","feathered friends","few and far between","fifteen minutes of fame","filthy vermin","fine kettle of fish","fish out of water","fishing for a compliment","fit as a fiddle","fit the bill","fit to be tied","flash in the pan","flat as a pancake","flip your lid","flog a dead horse","fly by night","fly the coop","follow your heart","for all intents and purposes","for the birds","for what it is worth","force of nature","force to be reckoned with","forgive and forget","fox in the henhouse","free and easy","free as a bird","fresh as a daisy","full steam ahead","fun in the sun","garbage in, garbage out","gentle as a lamb","get a kick out of","get a leg up","get down and dirty","get the lead out","get to the bottom of","get your feet wet","gets my goat","gilding the lily","give and take","go against the grain","go at it tooth and nail","go for broke","go him one better","go the extra mile","go with the flow","goes without saying","good as gold","good deed for the day","good things come to those who wait","good time was had by all","good times were had by all","greased lightning","greek to me","green thumb","green-eyed monster","grist for the mill","growing like a weed","hair of the dog","hand to mouth","happy as a clam","happy as a lark","have a nice day","have high hopes","have the last laugh","have not got a row to hoe","head honcho","head over heels","hear a pin drop","heard it through the grapevine","heart's content","heavy as lead","hem and haw","high and dry","high and mighty","high as a kite","hit paydirt","hold your head up high","hold your horses","hold your own","hold your tongue","honest as the day is long","horns of a dilemma","horse of a different color","hot under the collar","hour of need","I beg to differ","icing on the cake","if the shoe fits","if the shoe were on the other foot","in a jam","in a jiffy","in a nutshell","in a pig's eye","in a pinch","in a word","in hot water","in the gutter","in the nick of time","in the thick of it","in your dreams","the fat lady sings","it goes without saying","it takes all kinds","it takes one to know one","it is a small world","it is only a matter of time","ivory tower","Jack of all trades","jockey for position","jog your memory","joined at the hip","judge a book by its cover","jump down your throat","jump in with both feet","jump on the bandwagon","jump the gun","jump to conclusions","just a hop, skip, and a jump","just the ticket","justice is blind","keep a stiff upper lip","keep an eye on","keep it simple, stupid","keep the home fires burning","keep up with the Joneses","keep your chin up","keep your fingers crossed","kick the bucket","kick up your heels","kick your feet up","kid in a candy store","kill two birds with one stone","kiss of death","knock it out of the park","knock on wood","knock your socks off","know him from Adam","know the ropes","know the score","knuckle down","knuckle sandwich","knuckle under","labor of love","ladder of success","land on your feet","lap of luxury","last but not least","last hurrah","last-ditch effort","law of the jungle","law of the land","lay down the law","leaps and bounds","let sleeping dogs lie","let the cat out of the bag","let the good times roll","let your hair down","let's talk turkey","letter perfect","lick your wounds","lies like a rug","life's a grind","light at the end of the tunnel","lighter than a feather","lighter than air","like clockwork","like father like son","like taking candy from a baby","like the plague","like there's no tomorrow","lion's share","live and learn","live and let live","long and short of it","long lost love","look before you leap","look down your nose","look what the cat dragged in","looking a gift horse in the mouth","looks like death warmed over","loose cannon","lose your head","lose your temper","loud as a horn","lounge lizard","loved and lost","low man on the totem pole","luck of the draw","luck of the Irish","make hay while the sun shines","make money hand over fist","make my day","make the best of a bad situation","make the best of it","make your blood boil","man of few words","man's best friend","mark my words","meaningful dialogue","missed the boat on that one","moment in the sun","moment of glory","moment of truth","money to burn","more power to you","more than one way to skin a cat","movers and shakers","moving experience","naked as a jaybird","naked truth","neat as a pin","needle in a haystack","needless to say","neither here nor there","never look back","never say never","nip and tuck","nip it in the bud","no guts, no glory","no love lost","no pain, no gain","no skin off my back","no stone unturned","no time like the present","no use crying over spilled milk","nose to the grindstone","not a hope in hell","not a minute's peace","not in my backyard","not playing with a full deck","not the end of the world","not written in stone","nothing to sneeze at","nothing ventured nothing gained","now we are cooking","off the top of my head","off the wagon","off the wall","old hat","older and wiser","older than dirt","older than Methuselah","on a roll","on cloud nine","on pins and needles","on the bandwagon","on the money","on the nose","on the rocks","on the spot","on the tip of my tongue","on the wagon","on thin ice","once bitten, twice shy","one bad apple does not spoil the bushel","one born every minute","one brick short","one foot in the grave","one in a million","one red cent","only game in town","open a can of worms","open and shut case","open the flood gates","opportunity does not knock twice","out of pocket","out of sight, out of mind","out of the frying pan into the fire","out of the woods","out on a limb","over a barrel","over the hump","pain and suffering","pain in the","panic button","par for the course","part and parcel","party pooper","pass the buck","patience is a virtue","pay through the nose","penny pincher","perfect storm","pig in a poke","pile it on","pillar of the community","pin your hopes on","pitter patter of little feet","plain as day","plain as the nose on your face","play by the rules","play your cards right","playing the field","playing with fire","pleased as punch","plenty of fish in the sea","point with pride","poor as a church mouse","pot calling the kettle black","pretty as a picture","pull a fast one","pull your punches","pulling your leg","pure as the driven snow","put it in a nutshell","put one over on you","put the cart before the horse","put the pedal to the metal","put your best foot forward","put your foot down","quick as a bunny","quick as a lick","quick as a wink","quick as lightning","quiet as a dormouse","rags to riches","raining buckets","raining cats and dogs","rank and file","rat race","reap what you sow","red as a beet","red herring","reinvent the wheel","rich and famous","rings a bell","ripe old age","ripped me off","rise and shine","road to hell is paved with good intentions","rob Peter to pay Paul","roll over in the grave","rub the wrong way","ruled the roost","running in circles","sad but true","sadder but wiser","salt of the earth","scared stiff","scared to death","sealed with a kiss","second to none","see eye to eye","seen the light","seize the day","set the record straight","set the world on fire","set your teeth on edge","sharp as a tack","shoot for the moon","shoot the breeze","shot in the dark","shoulder to the wheel","sick as a dog","sigh of relief","signed, sealed, and delivered","sink or swim","six of one, half a dozen of another","skating on thin ice","slept like a log","slinging mud","slippery as an eel","slow as molasses","smart as a whip","smooth as a baby's bottom","sneaking suspicion","snug as a bug in a rug","sow wild oats","spare the rod, spoil the child","speak of the devil","spilled the beans","spinning your wheels","spitting image of","spoke with relish","spread like wildfire","spring to life","squeaky wheel gets the grease","stands out like a sore thumb","start from scratch","stick in the mud","still waters run deep","stitch in time","stop and smell the roses","straight as an arrow","straw that broke the camel's back","strong as an ox","stubborn as a mule","stuff that dreams are made of","stuffed shirt","sweating blood","sweating bullets","take a load off","take one for the team","take the bait","take the bull by the horns","take the plunge","takes one to know one","takes two to tango","the more the merrier","the real deal","the real McCoy","the red carpet treatment","the same old story","there is no accounting for taste","thick as a brick","thick as thieves","thin as a rail","think outside of the box","think outside the box","third time's the charm","third time is the charm","this day and age","this hurts me worse than it hurts you","this point in time","three sheets to the wind","through thick and thin","throw in the towel","tie one on","tighter than a drum","time and time again","time is of the essence","tip of the iceberg","tired but happy","to coin a phrase","to each his own","to make a long story short","to the best of my knowledge","toe the line","tongue in cheek","too good to be true","too hot to handle","too numerous to mention","touch with a ten foot pole","tough as nails","trial and error","trials and tribulations","tried and true","trip down memory lane","twist of fate","two cents worth","two peas in a pod","ugly as sin","under the counter","under the gun","under the same roof","under the weather","until the cows come home","unvarnished truth","up the creek","uphill battle","upper crust","upset the applecart","vain attempt","vain effort","vanquish the enemy","vested interest","waiting for the other shoe to drop","wakeup call","warm welcome","watch your p's and q's","watch your tongue","watching the clock","water under the bridge","weather the storm","weed them out","week of Sundays","went belly up","wet behind the ears","what goes around comes around","what you see is what you get","when it rains, it pours","when push comes to shove","when the cat's away","when the going gets tough, the tough get going","white as a sheet","whole ball of wax","whole hog","whole nine yards","wild goose chase","will wonders never cease?","wisdom of the ages","wise as an owl","wolf at the door","words fail me","work like a dog","world weary","worst nightmare","worth its weight in gold","wrong side of the bed","yanking your chain","yappy as a dog","years young","you are what you eat","you can run but you cannot hide","you only live once","you are the boss","young and foolish","young and vibrant"];
                    let regex = new RegExp(`\\b(?:${cliches.map(c => c.replace(/ /g, "[ ]+")).join("|")})\\b`, "gi");
                    return Muzzy.Errors.getIndexes(text, regex, quotes);
                }
            },
            DICTION_WARRANT: { // Check for this shows, this {word} shows
                name: "Weak Reasoning",
                description: 'Never simply say "this shows." Instead, illustrate how you know what it shows.',
                example: "This quote shows that Taco Bell is amazing. >>> The continuing glow of the decades-old Liberty Bell illustrates the incredible resilience of Taco Bell.",
                type: Muzzy.types.DEPTH,
                handler: (text, quotes) => {
                    const showsRegex = /\b(?:this|that)(?:[ ]+[^ ]*?[ ]+|[ ]+)(?:shows)\b/gi;
                    const showingRegex = /\b(?:thus|therefore)(?:[ ]+[^ ]*?[ ]+|[ ]+)(?:showing)\b/gi;

                    return Muzzy.Errors.getIndexes(text, showsRegex, quotes).concat(Muzzy.Errors.getIndexes(text, showingRegex, quotes));
                }
            },
            BAD_QUOTE: { // Check for single words in quotes
                name: "Air Quotes",
                description: "Unnecessarily quoting single words for a sarcastic effect may cause your essay to sound less formal. This should only be done when citing a source.",
                example: 'One could say Amy is "enthusiastic" about the party. >>> Amy is not overly enthusiastic about the party.',
                type: Muzzy.types.FORMALITY,
                handler: (text, quotes) => {
                    const badQuoteIndexes = quotes.filter(quot => quot.split(" ").length == 1 && quot != '""').map(quot => quotes.indexOf(quot));
                    return Muzzy.Errors.getIndexes(text, Muzzy.QUOTE, quotes, true).filter((_v, i) => badQuoteIndexes.includes(i));
                }
            },
            QUOTE_TRANSITION: { // Check for quotes that begin a sentence, these need transitions before them
                name: "Quote Transition",
                description: "Quotes should not simply be thrown into an essay. Who says the quote, and to whom? Provide background information before inserting the quote.",
                example: '"Hark, elephant! I am your god!" >>> After drinking six beers, Captain Freeman looks at the sculpture of the elephant and cries, "Hark, elephant! I am your god!" (Nutts and Dees 2023).',
                type: Muzzy.types.DEPTH,
                handler: (text, quotes) => {
                    const regex = XRegExp(`(?<=\\.[ ]+)${Muzzy.QUOTE}`, "g");
                    return Muzzy.Errors.getIndexes(text, regex, quotes, true);
                }
            },
            QUOTE_FORMAT: { // Check for quotes without parenthetical citations
                name: "Quote Formatting",
                description: "All quotes should have in-text, parenthetical citations or reference the last name of the person that stated the quote.",
                example: 'Khan\'s approach is "thoroughly revealed by mathematics." >>> Khan\'s approach is "thoroughly revealed by mathematics" (Washington 2023).',
                type: Muzzy.types.MLA,
                handler: (text, quotes, fullText) => {
                    const regex = new RegExp(`${Muzzy.QUOTE}(?![ ]+\\()`, "g");
                    return Muzzy.Errors.getIndexes(text, regex, quotes, true).filter(val => {
                        const quote = fullText.substring(val.index + 1, val.index - 1 + val.length);
                        return !Muzzy.References.isTitle(quote);
                    });
                }
            },
            INANIMATE_DICTION: { // Check for book says, rule states, novel says, article says, book states, rule says, novel states, article states, story says, story states
                name: "Inanimate Diction",
                description: 'Never write phrases such as "the book says." Inanimate objects cannot speak; the book is not actually saying or stating anything.',
                example: "The rule states that lights must be off by midnight. >>> According to the rule, the lights must be off by midnight.",
                type: Muzzy.types.AWARENESS,
                handler: (text, quotes) => {
                    const regex = /\b(?:book|rule|novel|article|story)[ ]+(?:says|states)\b/gi;
                    return Muzzy.Errors.getIndexes(text, regex, quotes);
                }
            },
            STORY_REFERENCE: { // With exception to first 5 sentences, check for references to the/a book, the/a novel, the/an article, the/a play, characters, the/a story
                name: "Reference to the Story",
                description: 'Never refer to a book as "the book" or characters in a novel as "the characters" in your essay, except when introducing a novel in your introduction.',
                example: "Unlike the other characters, Proctor believes in fairness at the end of the play. >>> Unlike the others, Proctor believes in fairness.",
                type: Muzzy.types.AWARENESS,
                handler: (text, quotes) => {
                    const regex = /\b(?:characters|(?:the|a|an)[ ]+(?:book|novel|article|play|story|webpage))\b/gi;
                    const sentences = Muzzy.Errors.getIndexes(text, /[.!?]+/g, quotes).slice(0, 5).at(-1);
                    return Muzzy.Errors.getIndexes(text, regex, quotes).filter(val => {
                        return val.index > sentences.index;
                    });
                }
            },
            CONTRACTIONS: { // Check for contractions
                name: "Contractions",
                description: "Contractions, shortened forms of two or more words, should not be used in formal works.",
                example: "Axel won't believe Aaron's lies. >>> Axel will not believe Aaron's lies.",
                type: Muzzy.types.FORMALITY,
                handler: (text, quotes) => {
                    const regex = /\b(?:ain't|aren't|can't|couldn't|could've|didn't|doesn't|don't|hadn't|hasn't|haven't|he'd|he'll|he's|i'd|i'll|i'm|it'd|i've|isn't|it's|let's|mightn't|might've|mustn't|must've|needn't|shan't|she'd|she'll|she's|shouldn't|should've|that's|there's|they'd|they'll|they're|they've|wasn't|we'd|we're|we've|weren't|what'll|what're|what's|what've|where's|who'd|who'll|who're|who's|who've|won't|wouldn't|would've|y'all|you'd|you'll|you're|you've)\b/gi;
                    return Muzzy.Errors.getIndexes(text, regex, quotes);
                }
            },

            UNNECESSARY_CAPS: { // Check for words such as hieroglyphics being unnecessarily capitalized
                name: "Unnecessary Caps",
                description: "This word most likely should not be capitalized, as it appears to be a common noun &mdash; not a proper noun.",
                example: "According to History, Astronomers are amazing! >>> According to history, astronomers are amazing!",
                type: Muzzy.types.FORMALITY,
                handler: (text, quotes) => {
                    const regex = XRegExp(`(?<!^|\\.\\s+)\\b(?:Hieroglyphics|Emoji|Gods|History|Math|Economics|[A-Z][a-z]*(?:ography|ology|onomy|onymy|onomer|onomers|ologer|ologers|ographer|ographers))\\b`, "g");
                    return Muzzy.Errors.getIndexes(text, regex, quotes);
                }
            },

            BAD_PUNCTUATION: { // Check for bad/unprofessional punctuation
                name: "Bad Punctuation",
                description: "This punctuation is either invalid, informal, or should not be used in MLA-formatted essays.",
                example: "This punctuation is unprofessional?! >>> This punctuation is professional.",
                type: Muzzy.types.MLA,
                handler: (text, quotes) => {
                    const regex = XRegExp(`(?:(?:\\?*!+\\?*)+|\\?\\?+|,,+|;;+|::+|\\|+|\\\+|&+|\\*+|<+|>+|\\[+|\\]+|{+(?!${Muzzy.QUOTE.replace(/[{}]/g, "")})|(?<!${Muzzy.QUOTE.replace(/[{}]/g, "")})}+|\\^+|#+|@+|\\++|_+|=+|~+|\`+)`, "g");
                    return Muzzy.Errors.getIndexes(text, regex, quotes);
                }
            },

            SELF_REFERENCE: { // Check for "this essay" and "paragraph", no self references
                name: "Self References",
                description: "Do not reference your own essay or specifically refer to previous, current, or future paragraphs.",
                example: "As mentioned in my previous paragraph, this essay demonstrates that wisdom defeats brute strength. >>> As aforementioned, wisdom defeats brute strength.",
                type: Muzzy.types.AWARENESS,
                handler: (text, quotes) => {
                    const regex = /\b(?:this[ ]+essay|(?:this|previous|earlier|next|later|current|that|prior|latter|former)[ ]+paragraph)\b/gi;
                    return Muzzy.Errors.getIndexes(text, regex, quotes);
                }
            },

            DATED_ABBREVIATIONS: { // Check for outdated abbreviations such as N.A.S.A. and C.E.O.
                name: "Outdated Abbreviations",
                description: "In the modern day, this abbreviation does not require abbreviating periods.",
                example: "The new C.E.O. is initiating breakthroughs. >>> The new CEO is initiating breakthroughs.",
                type: Muzzy.types.SPELLING,
                handler: (text, quotes) => {
                    const regex = /\b(?:N\.A\.S\.A\.?|C\.E\.O\.?)(?![a-z]|\.[a-z])/gi;
                    return Muzzy.Errors.getIndexes(text, regex, quotes);
                }
            },

            PASSIVE: { // Check for passive voice
                name: "Passive Voice",
                description: "This is possibly passive voice, which MLA-formatted essays should not use.",
                example: "The problem is solved when Jay turns it off. >>> Jay solves the problem by turning it off.",
                type: Muzzy.types.MLA,
                handler: (text, quotes) => {
                    return Muzzy.lib.writegood.passive(text).map(res => {
                        return {
                            index: Muzzy.Errors.__getTrueIndex(res.index, text, quotes),
                            length: res.offset
                        };
                    });
                }
            },

            WORDINESS: { // Check for wordiness
                name: "Wordiness",
                description: "This may be excessively wordy, which can lower the quality of your essay.",
                example: "It is the case that Minecraft is a great game. >>> Minecraft is a great game.",
                type: Muzzy.types.DEPTH,
                handler: (text, quotes) => {
                    return Muzzy.lib.writegood.wordy(text).map(res => {
                        return {
                            index: Muzzy.Errors.__getTrueIndex(res.index, text, quotes),
                            length: res.offset
                        };
                    });
                }
            },

            SPELLING: { // Check for known spelling errors
                name: "Spelling Error",
                description: "This word may have been incorrectly spelled.",
                example: "The dictionary loves to mispell things. >>> The dictionary loves to misspell things.",
                type: Muzzy.types.SPELLING,
                handler: (text, quotes, fullText) => {
                    const wordSplitter = [{
                        index: -1
                    }].concat(Muzzy.Errors.getIndexes(text, /[ ]+/g, quotes));
                    const results = [];

                    for (let i = 0; i < wordSplitter.length; i++) {
                        const wordLength = (wordSplitter[i+1]?.index ?? fullText.length - 1) - wordSplitter[i].index - 1;
                        const wordIndex = {
                            index: wordSplitter[i].index + 1,
                            length: wordLength
                        };

                        const word = fullText.substring(wordIndex.index, wordIndex.index + wordIndex.length);
                        if (word.match(/["]|[0-9]/g)) continue;
                        wordIndex.length = word.replace(/[^a-z']+$/gi, "").length;

                        if (!Muzzy.lib.typojs.check(word.toUpperCase().replace(/[^a-z']/gi, ""))) results.push(wordIndex);
                    }

                    return results;
                }
            }
            
            /*
                Error counts:

                5 formality
                3 awareness
                5 depth
                6 mla
                2 spelling
            */
        }

        static __getTrueIndex(index, mutatedText, quotes) {
            const quoteAmount = (mutatedText.slice(0, index).match(new RegExp(Muzzy.QUOTE, "g")) ?? []).length;

            let mutatedIndex = index - (quoteAmount * Muzzy.QUOTE.length) + quotes.slice(0, quoteAmount).reduce((prev, curr) => prev + curr.length, 0);
            return mutatedIndex;
        }

        static __getQuoteLength(index, mutatedText, quotes) {
            const quoteAmount = (mutatedText.slice(0, index).match(new RegExp(Muzzy.QUOTE, "g")) ?? []).length;
            return quotes[quoteAmount].length;
        }

        static getIndexes(str, regexp, quotes, isQuote) {
            const result = [];

            let match, pos = 0;
            while (match = XRegExp.exec(str, XRegExp(regexp), pos)) {
                result.push({ index: this.__getTrueIndex(match.index, str, quotes), length: isQuote ? this.__getQuoteLength(match.index, str, quotes) : match[0].length });
                pos = match.index + match[0].length;
            }

            return result;
        }

        static indexesIntersect(ax, aLen, bx, bLen) {
            const ay = ax + aLen - 1;
            const by = bx + bLen - 1;

            return (bx >= ax && bx <= ay) || (ax >= bx && ax <= by);
        }

        static getFullText() {
            return Muzzy.editor.getText();
        }

        static getCleanedText(text) {
            return text.replace(/(?:["]).*?(?:["])/g, Muzzy.QUOTE).replace(/\n/g, " ");
        }

        static getQuotes(text) {
            return text.match(/(?:["]).*?(?:["])/g) || [];
        }

        static check(format = true) {
            const fullText = this.getFullText();
            const mutatedText = this.getCleanedText(fullText);
            const quotes = this.getQuotes(fullText);
            const errors = [];

            /*
                Error handler return structure:
                {
                    index: Number,
                    length: Number
                }

                Post-check error structure:
                {
                    index: Number,
                    length: Number,
                    errorId: keyof Muzzy.Errors.list
                }
            */

            for (const errorId in Muzzy.Errors.list) {
                const outputs = Muzzy.Errors.list[errorId].handler(mutatedText, quotes, fullText);
                if (!outputs) continue;

                const results = outputs.map(output => ({
                    ...output,
                    errorId
                }));

                results.forEach(result => {
                    if (format) {
                        const intersection = errors.some(err => this.indexesIntersect(err.index, err.length, result.index, result.length));
                        if (intersection) return;
                        Muzzy.Errors.format(result);
                    }

                    errors.push(result);
                });
            }

            this.currentErrors = errors;
            return errors;
        }

        static createPopover(elem) {
            const err = Muzzy.Errors.list[$(elem).attr("error")];
            const template = $("#muzzy-error-popover");
            template.find(".muzzy-error-name").html(err.name);
            template.find(".muzzy-error-desc").html(err.description);
            template.find(".muzzy-error-example-wrong").html(err.example.split(" >>> ")[0]);
            template.find(".muzzy-error-example-correct").html(err.example.split(" >>> ")[1]);
            template.find(".muzzy-error-type").html(err.type);
            template.find(".muzzy-error-type").attr("type", err.type);
            
            tippy(elem, {
                content: template.html(),
                allowHTML: true,
                arrow: true,
                interactive: true,
                interactiveBorder: 30,
                appendTo: () => document.body,
                maxWidth: 500,
                trigger: 'click',
                placement: 'bottom',
                onCreate(instance) {
                    const ignore = () => {
                        Muzzy.Errors.ignore(elem);
                        instance.hide();
                        $(instance.popper).find(".muzzy-error-ignore").html("Unignore");
                        $(instance.popper).find(".muzzy-error-ignore").off("click");
                        $(instance.popper).find(".muzzy-error-ignore").on("click", unignore);
                    };
                    const unignore = () => {
                        Muzzy.Errors.unignore(elem, "never");
                        instance.hide();
                        $(instance.popper).find(".muzzy-error-ignore").html("Ignore");
                        $(instance.popper).find(".muzzy-error-ignore").off("click");
                        $(instance.popper).find(".muzzy-error-ignore").on("click", ignore);
                    };

                    $(instance.popper).find(".muzzy-error-ignore").on("click", ignore);
                    $(instance.popper).find(".muzzy-error-report").on("click", () => {
                        Muzzy.Errors.showReport(Muzzy.getIndexFromElem(elem))
                        instance.hide();
                    });
                }
            });
        }

        static format({ index, length, errorId }) {
            Muzzy.editor.formatText(index, length, "muzzyerror", { id: errorId }, "silent");
        }

        static _ignoredErrors = [];

        static ignore(elem) {
            $(elem).attr("error-ignore", true);
            this._ignoredErrors.push({elem, index: Muzzy.editor.getIndex(Quill.find(elem)), errorId: $(elem).attr("error")});
            this.updateErrorCount();
        }

        static unignore(elem, state=false) {
            $(elem).attr("error-ignore", state);
            this._ignoredErrors.splice(this._ignoredErrors.findIndex(err => err.elem == elem), 1);
            this.updateErrorCount();
        }

        static isIgnored(elem) {
            return $(elem).attr("error-ignore") == "true";
        }

        static updateErrorCount() {
            $(".footer-errs").html($(".muzzy-error:not([error-ignore=true]):not(.muzzy-error-report-error)").length);
        }

        static toggleChecking() {
            if (this.checksEnabled) {
                Muzzy.editor.updateContents(new Delta()
                    .retain(Muzzy.editor.getLength(), { muzzyerror: false }),  // Removes muzzyerror formatting from this segment of text
                    "silent"
                );
                this._ignoredErrors = [];
                this.checksEnabled = false;
                this.currentErrors = [];
            }
            else {
                this.checksEnabled = true;
                this.check();
            }

            this.updateErrorCount();
        }

        static generateReport() {
            let report = `
            <p class="title is-3">Muzzy Error Report</p>
            `;

            const errorTypes = Object.values(Muzzy.types).filter(type => Muzzy.Errors.currentErrors.some(err => Muzzy.Errors.list[err.errorId].type == type));
            for (const type of errorTypes) {
                const typedErrors = Muzzy.Errors.currentErrors.filter(err => Muzzy.Errors.list[err.errorId].type == type);

                report += `
                <hr />
                <p class="title is-4 muzzy-error muzzy-error-report-error" type="${type}" error-ignore="never">${type} &times;${typedErrors.length}</p>
                <p class="subtitle is-5">${Muzzy.types.descriptions[type]}</p>
                `;

                let prevErrId = null;

                typedErrors.forEach(errIndex => {
                    const err = Muzzy.Errors.list[errIndex.errorId];
                    const isIgnored = Muzzy.Errors._ignoredErrors.some(e => e.index == errIndex.index);

                    let snippetLength = 20;
                    const errText = Muzzy.editor.getText(errIndex.index, errIndex.length);
                    const errPretext = Muzzy.editor.getText(errIndex.index - snippetLength, snippetLength).trim();
                    const errProtext = Muzzy.editor.getText(errIndex.index + errIndex.length, snippetLength).trim();

                    if (prevErrId != (prevErrId = errIndex.errorId)) report += `
                    <br />
                    <p class="content muzzy-error-report-name">
                    ${err.name}
                    </p>
                    <p class="content muzzy-error-report-desc">
                    ${err.description}
                    </p>
                    `;

                    report += `
                    <div class="notification muzzy-error-example-box is-danger" onclick="$.modal.close(); Muzzy.editor.setSelection(${errIndex.index}, ${errIndex.length}); Muzzy.getElemFromIndex(${errIndex.index})?._tippy?.show();" data-index="${errIndex.index}">
                    ${isIgnored ? `
                    <span class='muzzy-error-example-corner' title='Ignored'>
                        <span class='example-label-large'>ign</span>
                        <span class="icon"><i class="iconify" data-icon="mdi-note-remove-outline"></i></span>
                    </span>` : ""}
                    &hellip;${errPretext} <i class="is-bold">${errText}</i> ${errProtext}&hellip;
                    </div>
                    `
                });
            }

            if (errorTypes.length == 0) {
                report += `
                <p class="content muzzy-error-report-desc">
                ${Muzzy.Errors.checksEnabled ? `
                Congratulations, no errors were found!
                ` : `
                You have currently disabled error-checking.
                `}
                </p>
                `;
            }

            report += `
            <div style="width:100%;display:flex;justify-content:center;align-items:center;">
            <a class="muzzy-error-button button" rel="modal:close">Close</a>
            </div>
            `;

            $("#muzzy-error-report").html(report);
        }

        static showReport(index) {
            this.generateReport();
            $("#muzzy-error-report").modal({
                fadeDuration: 200,
                fadeDelay: 0.5
            });

            if (index != undefined) {
                setTimeout(() => {
                    $('.jquery-modal').animate({
                        scrollTop: $(`[data-index=${index}]`).offset()?.top
                    }, 2000);

                    $(`[data-index=${index}]`).css("background-color", "#fb0e3d");
                }, 100);
            }
        }

    }

    static Nav = {};
    static Themes = {
        list: [
            "Sunset",
            "Dark",
            "Seaside",
            "Lavender",
            "Grapefruit",
            "Strawberry Lemonade",
            "Borealis",
            "Raspberry",
            "Ritual",
            "Matrix",
            "Classic"
        ],
        set(themeName) {
            $("html").attr("class", `theme theme-${themeName.toLowerCase().replace(/ /g, "-")}`);
            $(".muzzy-theme-id").html(`Muzzy ${themeName}`);
            Muzzy.Database.set("theme", themeName);
        }
    };

    static getElemFromIndex(index) {
        return Muzzy.editor.getLeaf(index + 1)?.[0]?.parent?.domNode;
    }

    static getIndexFromElem(elem) {
        return Muzzy.editor.getIndex(Quill.find(elem));
    }

    static dynamicTooltip(content) {
        $(".footer-muzzy").attr("data-tooltip", content);
        $(".footer-muzzy").get(0)._tippy.show();
    }

    static _saveTimeout = null;
    static _saveDefaultId = "w4zm0zzy";

    static __editorSaveCallback() {
        const name = Muzzy._saveDefaultId;

        Muzzy.Database.edit(db => {
            db.docs ??= [];

            const foundDoc = db.docs.find(doc => doc.name == name);
            const doc = foundDoc ?? {
                name,
                title: "Untitled Muzzy Doc",
                content: ""
            };
            doc.content = Muzzy.editor.getContents();
            if (!foundDoc) db.docs.push(doc);
        });
    }

    static __editorLoadData() {
        return Muzzy.Database.get("docs", []).find(doc => doc.name == Muzzy._saveDefaultId)?.content ?? {ops: []};
    }

    static editorSave() {
        const timeInterval = 500;
        clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(this.__editorSaveCallback, timeInterval);
    }

    static editorLoad() {
        const data = Muzzy.__editorLoadData();
        Muzzy.editor.setContents(data);
    }

    static toMuzzyFile() {
        return Base64.encode(JSON.stringify(Muzzy.__editorLoadData()));
    }

    static fromMuzzyFile(content) {
        return JSON.parse(Base64.decode(content));
    }

}