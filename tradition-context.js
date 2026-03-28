/**
 * tradition-context.js
 * Shared denomination voice profiles — injected into prompts for theological accuracy.
 * Used by both server.js (Compare) and research-engine.js (Research).
 *
 * Format: free-form string describing the tradition's theological voice, sources,
 * and distinctives — enough for Claude to respond authentically in that tradition's idiom.
 */

export const TRADITION_CONTEXT = {

  // ── Christianity (generic + denominations) ────────────────────────────────
  'Christianity':
    'Christianity: Jesus Christ as Lord, Savior, and the Second Person of the Trinity. The Incarnation, crucifixion, resurrection, and ascension as the central saving events. Scripture (Old and New Testament) as the authoritative Word of God. The Church as the Body of Christ. Salvation through faith in Christ. Baptism and Communion as sacramental practices across most traditions. The Great Commission — to make disciples of all nations. Eschatological hope in Christ\'s return and the resurrection of the dead.',

  'Roman Catholic':
    'Roman Catholic Christianity: Teaching authority of the Pope and Magisterium as definitive. Seven sacraments as objective means of grace. Scripture and Sacred Tradition as co-equal sources of revelation. Natural law ethics. Veneration of Mary (Theotokos, Immaculate Conception, Assumption) and the communion of saints. The Mass as the re-presentation of Christ\'s sacrifice (transubstantiation). Apostolic succession from Peter.',

  'Eastern Orthodox':
    'Eastern Orthodox Christianity: Theosis — union with God — as the goal of Christian life. Conciliar authority; no single bishop above others. The Philokalia and hesychast tradition of contemplative prayer. Icons as windows into divine reality, not idols. The Divine Liturgy of St. John Chrysostom. Seven Ecumenical Councils as doctrinal authority. Scripture interpreted through Holy Tradition. Emphasis on mystery, apophatic theology, and the uncreated energies of God.',

  'Baptist':
    'Baptist Christianity: Soul competency — each person answers directly to God without priestly mediation. Scripture alone (Sola Scriptura) as final authority. Believer\'s baptism by immersion only — not infant baptism. Local church autonomy, no hierarchy above the congregation. Priesthood of all believers. Personal conversion experience ("born again") as the mark of genuine faith. Strong emphasis on evangelism and missions.',

  'Methodist':
    'Methodist Christianity: The Wesleyan Quadrilateral — Scripture, Tradition, Reason, and Experience as sources of authority. Prevenient grace — God\'s grace available to all before conversion. Sanctification as a lifelong journey toward entire holiness. Social holiness — faith must express in justice, service, and social reform. Connectionalism between local churches. John Wesley\'s emphasis on practical Christianity and ministry to the poor.',

  'Lutheran':
    'Lutheran Christianity: Justification by grace through faith alone (Sola Fide) as the article on which the Church stands or falls. Scripture alone (Sola Scriptura). The Law-Gospel distinction — the tension between God\'s demand and God\'s mercy as central to preaching. Two kingdoms theology. Real presence of Christ in the Eucharist (not transubstantiation, not mere symbol). Luther\'s Small and Large Catechisms as foundational teaching texts.',

  'Pentecostal':
    'Pentecostal Christianity: Baptism of the Holy Spirit as a second definite work of grace, evidenced by speaking in tongues (glossolalia). The gifts of the Spirit are active today — healing, prophecy, tongues, interpretation. Direct, experiential encounter with God in worship. Eschatological urgency — Christ\'s return is imminent. Expressive, participatory worship with prayer, praise, and physical manifestations. Scripture as literally inspired and inerrant.',

  'Latter-day Saints':
    'The Church of Jesus Christ of Latter-day Saints (Latter-day Saints): Restoration theology — the Church as the restored original church of Jesus Christ. Scripture includes the Bible and Book of Mormon as companion witnesses of Christ. Continuing revelation through a living prophet. Eternal progression and exaltation. Sacred temple ordinances. Lay priesthood. Strong emphasis on family, community, and self-reliance. Christ-centered in all theology and practice.',

  // ── Judaism (generic + denominations) ────────────────────────────────────
  'Judaism':
    'Judaism: Ethical monotheism — one God, creator and sustainer of all. The covenant between God and the Jewish people, initiated with Abraham and renewed at Sinai. Torah (Written and Oral) as the revealed word of God, guiding all of life. Halakha as the path of right living. The centrality of Shabbat, holy days, and lifecycle rituals. Hebrew as the sacred language of prayer and scripture. The Land of Israel as part of the covenantal promise. Teshuvah (repentance and return) and chesed (lovingkindness) as core values. The Jewish people as a witness community in the world.',

  'Orthodox Judaism':
    'Orthodox Judaism: Halakha (Jewish law) as binding and divinely revealed to Moses at Sinai. Torah min haShamayim — the divine, verbatim origin of both the Written Torah and the Oral Torah (Talmud). The Babylonian Talmud as the primary text of rabbinic authority. Poskim (halakhic decisors) — Rambam, Shulchan Aruch, contemporary responsa — as ongoing authorities. Mechitza separating men and women in prayer. Strict Shabbat and kashrut observance. Yeshiva learning as the religious ideal.',

  'Conservative Judaism':
    'Conservative Judaism (Masorti): Halakha is binding but evolves through scholarly interpretation responsive to historical context. The Jewish Theological Seminary (JTS) as the intellectual center of the movement. Historical-critical method applied to Jewish texts alongside traditional learning. Full egalitarianism — men and women participate equally in prayer and leadership. Commitment to the State of Israel and Hebrew as the sacred language. The Committee on Jewish Law and Standards as the authoritative halakhic body.',

  'Reform Judaism':
    'Reform Judaism: The autonomy of the individual Jew in their relationship with tradition and practice. Ethical monotheism as the core of Judaism — the prophetic tradition of justice over ritual. Torah as divinely inspired but not literally dictated word-for-word. Hebrew integrated with vernacular in worship. Full egalitarianism — women rabbis since 1972, LGBTQ+ inclusion. Strong emphasis on tikkun olam (repair of the world) as a primary religious obligation. Patrilineal descent recognized alongside matrilineal.',

  // ── Islam (generic + denominations) ──────────────────────────────────────
  'Islam':
    'Islam: Tawhid — the absolute, uncompromising oneness of God (Allah). The Quran as the literal, final, uncreated Word of God, revealed to the Prophet Muhammad (peace be upon him) through the Angel Jibreel. Muhammad as the Seal of the Prophets. The Five Pillars: Shahada (testimony of faith), Salat (prayer five times daily), Zakat (obligatory almsgiving), Sawm (fasting in Ramadan), Hajj (pilgrimage to Mecca). The Six Articles of Faith. Shariah as a comprehensive, God-given way of life. The Ummah — the global community of believers — as a single family.',

  'Sunni Islam':
    'Sunni Islam (Ahl al-Sunnah): The majority tradition (~85-90% of Muslims). Authority through scholarly consensus (ijma\') and analogical reasoning (qiyas). Four legal schools: Hanafi, Maliki, Shafi\'i, Hanbali — all considered valid. Hadith collections of Bukhari and Muslim as the most authoritative. Emphasis on following the Prophet\'s Sunnah as recorded in hadith. The Six Articles of Faith and Five Pillars.',

  'Shia Islam':
    'Shia Islam (Twelver / Ithna Ashari): The Imamate — Ali and eleven Imams as the Prophet\'s divinely appointed successors, not elected. The Occultation of the Twelfth Imam (al-Mahdi), whose return is awaited. Marja\'iya — authority of living Grand Ayatollahs as deputies of the Hidden Imam. Karbala and the martyrdom of Husayn ibn Ali as central to spirituality and theology. Ziyarat — pilgrimage to shrines of Imams. Mourning rituals of Muharram (Ashura).',

  'Sufi Islam':
    'Sufi Islam (Tasawwuf): The inner, mystical dimension of Islam. The spiritual path (tariqa) toward direct experience of divine presence and annihilation of the ego (fana). Dhikr — rhythmic remembrance of God\'s names as the core practice. The shaykh-murid (master-disciple) relationship as essential. Maqamat — stations of the spiritual journey (tawba, sabr, tawakkul, mahabbah). Rumi, Ibn Arabi, Al-Ghazali, Rabia al-Adawiyya as foundational voices. Love (mahabbah) as the highest spiritual reality.',

  // ── Buddhism (generic + denominations) ───────────────────────────────────
  'Buddhism':
    'Buddhism: The Four Noble Truths — existence involves suffering (dukkha); suffering arises from craving and attachment (tanha); liberation is possible; the Noble Eightfold Path is the way. The Three Jewels: Buddha (the Awakened One), Dharma (the teaching), Sangha (the community). The Three Marks of Existence: impermanence (anicca), non-self (anatta), suffering (dukkha). Karma and the cycle of rebirth (samsara). The middle way between extreme asceticism and indulgence. Nirvana — the cessation of suffering through the extinction of craving. Compassion (karuna) and wisdom (prajna) as the twin pillars of practice.',

  'Theravada Buddhism':
    'Theravada Buddhism (The Way of the Elders): The oldest surviving school, predominant in Southeast Asia (Thailand, Myanmar, Sri Lanka, Cambodia). The Pali Canon (Tipitaka) — Vinaya, Sutta, Abhidhamma — as the authoritative scripture. The bhikkhu (monk) and the monastic sangha as the ideal path to liberation. Vipassana (insight meditation) and samatha (calm abiding) as the primary practices. Attainment of nibbana through the Noble Eightfold Path. The arahat — the liberated one — as the spiritual ideal.',

  'Zen Buddhism':
    'Zen Buddhism (Chan): Direct, unmediated awakening (satori or kensho) — seeing one\'s original nature. Transmission beyond scriptures — mind-to-mind transmission from teacher to student, not textual authority. Koan practice (Rinzai school) — paradoxical questions that shatter conceptual thinking. Zazen — seated meditation as the central practice (Soto school: shikantaza, "just sitting"). Integration of awakening into every moment of ordinary life — "chop wood, carry water." The Zendo and intensive sesshin retreats as the training ground.',

  'Tibetan Buddhism':
    'Tibetan Buddhism (Vajrayana / Tantric Buddhism): The tantric path as an accelerated route to Buddhahood in this very lifetime. Guru Yoga — the teacher (lama) is inseparable from the Buddha; devotion is primary. Deity yoga — visualization of enlightened beings (yidams) to recognize and embody their qualities. The Bardo Thodol (Tibetan Book of the Dead) as a guide to dying and rebirth. The Tulku system — reincarnated masters recognized and enthroned. The Bodhisattva vow — to attain enlightenment for the benefit of all sentient beings. Four schools: Gelug, Kagyu, Nyingma, Sakya.',

  // ── Other traditions ──────────────────────────────────────────────────────
  'Hinduism':
    'Hinduism: Brahman as the ultimate, formless, infinite reality underlying all existence. Atman — the individual soul — is ultimately one with Brahman (Tat tvam asi: "That art thou," Chandogya Upanishad). The Vedas, Upanishads, Bhagavad Gita, Ramayana, and Mahabharata as sacred scriptures. Multiple paths (margas) to liberation (moksha): jnana (knowledge), bhakti (devotion), karma (selfless action), raja (meditation). Dharma — cosmic and personal right conduct according to one\'s nature and stage of life. Samsara — the beginningless cycle of birth, death, and rebirth governed by karma. The divine expressed through many forms — Vishnu, Shiva, Shakti, Ganesha — as manifestations of the one Brahman. Ahimsa (non-violence) as a foundational ethical principle.',

  'Taoism':
    'Taoism (Daoism): The Tao (道) as the ineffable, unnameable source and sustaining principle of all things — "The Tao that can be told is not the eternal Tao" (Tao Te Ching, Ch. 1). Wu wei — effortless action in alignment with the natural flow of the Tao; not passivity but non-forcing. The Yin-Yang principle — complementary opposites in perpetual, dynamic balance. Te — the virtue or power that flows naturally from alignment with the Tao. The Three Treasures: compassion (ci), frugality (jian), humility. The Tao Te Ching (Laozi) and the Zhuangzi as the foundational texts. Harmony with nature, spontaneity (ziran), and simplicity as the spiritual path. The sage as the model — acting without ego, benefiting all without seeking recognition.',

  'Sikhism':
    'Sikhism: Ik Onkar — God is One, the Eternal Truth, the Creator, without fear or enmity, beyond time, self-existent, realized through the Guru\'s grace (Mool Mantar). The Guru Granth Sahib as the eternal, living Guru — the eleven human Gurus\' wisdom compiled as scripture and installed as the final Guru by Guru Gobind Singh. Waheguru — the Wonderful Lord — as the primary name of God. Naam Simran — meditative, loving remembrance of God\'s name as the core spiritual discipline. Seva — selfless service as an act of worship. The Langar — free communal kitchen — as a living expression of equality and seva. Three pillars of Sikh life: Naam Japo (remember God), Kirat Karo (earn honestly), Vand Chhako (share with others). The Khalsa — the community of the initiated — and the Five Ks. Rejection of caste, gender discrimination, and idol worship.',
};
