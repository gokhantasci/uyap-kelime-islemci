/**
 * UkiDictionary - Hukuki Terimler Sözlüğü Modülü (657.com.tr Entegrasyonu)
 * UYAP Kelime İşlemci için dahili hukuk sözlüğü, üzerine gelince (hover) bilgi kartı,
 * sağ tık (context menu) 'Ne Demek?' sorgusu ve 657.com.tr doğrudan sözlük bağlantısı.
 */
(function(window) {
    'use strict';

    // --------------------------------------------------------------------------
    // KAPSAMLI HUKUKİ TERİMLER VERİTABANI
    // --------------------------------------------------------------------------
    const TERMS_DB = [
        {
            term: "Müşteki",
            origin: "Ar. muştekī",
            category: "Ceza Muhakemesi",
            shortDef: "Suçtan zarar gören ve yetkili mercilere şikâyette bulunarak failin cezalandırılmasını talep eden kişi (şikâyetçi).",
            fullDef: "Ceza muhakemesinde suç şüphesini adli mercilere bildiren ve kamu davası açılmasını isteyen mağdur veya suçtan zarar gören kişi. Kovuşturma aşamasında davaya katılarak (müdahil) 'katılan' sıfatını alabilir.",
            slug: "musteki"
        },
        {
            term: "Müdafi",
            origin: "Ar. mudāfi'",
            category: "Ceza Muhakemesi",
            shortDef: "Ceza muhakemesinde şüpheli veya sanığın savunmasını üstlenen, haklarını koruyan avukat.",
            fullDef: "Ceza yargılamasında şüpheli veya sanığın savunmasını yürüten avukattır. Mağdur veya katılanı temsil eden avukata ise 'vekil' denir.",
            slug: "mudafi"
        },
        {
            term: "Bidayet",
            origin: "Ar. bidāyet",
            category: "Yargılama Usulü",
            shortDef: "Başlangıç, ilk derece; ilk derece mahkemesi (Bidayet Mahkemesi), davanın ilk görüldüğü safha.",
            fullDef: "Uyuşmazlığın ilk olarak karara bağlandığı ilk derece mahkemesini veya yargılamanın ilk safhasını ifade eder. 'Bidayet mahkemesi kararı' istinaf ve temyiz öncesi yerel mahkeme kararıdır.",
            slug: "bidayet"
        },
        {
            term: "Tevellüt",
            origin: "Ar. tevellüd",
            category: "Kişiler Hukuku",
            shortDef: "Doğum, doğum yılı veya tarihi; eski nüfus kayıtlarında ve mahkeme evrakında doğum tarihini belirtir.",
            fullDef: "Kişinin dünyaya gelmesi, doğumu. Eski adli tutanaklarda, nüfus cüzdanlarında ve gerekçeli kararlarda tarafın doğum yılını belirtmek amacıyla '1340 tevellütlü' şeklinde sıkça kullanılır.",
            slug: "tevellut"
        },
        {
            term: "İctinap",
            origin: "Ar. ictināb",
            category: "Yargılama Usulü",
            shortDef: "Çekinme, kaçınma; hâkimin veya bilirkişinin kanuni sebeplerle davaya bakmaktan kaçınması (çekinmesi).",
            fullDef: "Hâkimin, bilirkişinin veya zabıt kâtibinin tarafsızlığını şüpheye düşürecek sebepler yahut kanunda sayılan yasaklılık halleri nedeniyle davaya bakmaktan kendiliğinden çekinmesi hali (Hâkimin çekinmesi / İctinap).",
            slug: "ictinap"
        },
        {
            term: "Deruhte",
            origin: "Fars. der-'uhde",
            category: "Borçlar & Vekalet",
            shortDef: "Üstlenme, üzerine alma; bir işin, görevin veya davanın vekalet sorumluluğunu üzerine alma (deruhte etmek).",
            fullDef: "Bir görevi, yükümlülüğü veya hukuki işin yürütülmesini resmen üzerine almak. Mahkeme tutanaklarında 'vekilliğin deruhte edilmesi' şeklinde avukatın davayı üstlendiğini belirtmek için kullanılır.",
            slug: "deruhte"
        },
        {
            term: "Tensip",
            origin: "Ar. tensīb",
            category: "Yargılama Usulü",
            shortDef: "Uygun görme, kararlaştırma; davanın açılmasından sonra duruşma öncesi hazırlık işlemlerinin belirlendiği tensip zaptı.",
            fullDef: "Mahkemenin bir işlemi uygun ve gerekli görmesi. Davanın açılmasıyla birlikte hâkim tarafından hazırlanan, duruşma gününü, toplanacak delilleri ve müzekkereleri içeren tutanağa 'Tensip Zaptı' denir.",
            slug: "tensip"
        },
        {
            term: "İlam",
            origin: "Ar. i'lām",
            category: "Medeni Usul & İcra",
            shortDef: "Bildirme; mahkeme kararının taraflara verilen, kesinleşme ve icra kabiliyeti taşıyan onaylı resmî örneği.",
            fullDef: "Mahkemece verilen nihai kararın onaylı, mühürlü ve resmi suretidir. İlamlar doğrudan ilamlı icra takibine konu edilebilir ve kesin hüküm teşkil eder.",
            slug: "ilam"
        },
        {
            term: "Beraat",
            origin: "Ar. berā'et",
            category: "Ceza Muhakemesi",
            shortDef: "Aklanma, suçsuz bulunma; sanığın yüklenen fiilin suç olmaması veya faili olmadığının anlaşılması üzerine ceza almaması kararı.",
            fullDef: "Ceza davası sonucunda sanığın isnat edilen suçtan suçsuz bulunması, fiilin kanunda suç olarak tanımlanmamış olması veya delil yetersizliği nedenleriyle aklanması yönünde verilen nihai hüküm.",
            slug: "beraat"
        },
        {
            term: "Müruruzaman",
            origin: "Ar. murūruz-zamān",
            category: "Genel Hukuk",
            shortDef: "Zamanaşımı; kanunda belirlenen sürenin dolmasıyla dava açma veya hakkı talep etme yetkisinin düşmesi.",
            fullDef: "Kanunun belirlediği sürenin geçmesi sebebiyle bir hakkın dava edilebilme niteliğini kaybetmesi (def'i teşkil etmesi) veya ceza hukukunda kamu davasının ve cezanın ortadan kalkması hali.",
            slug: "mururuzaman"
        },
        {
            term: "Sebepsiz Zenginleşme",
            origin: "Türkçe Hukuk Terimi",
            category: "Borçlar Hukuku",
            shortDef: "Haklı bir sebep olmaksızın, bir kimsenin malvarlığının başka bir kimsenin malvarlığı aleyhine çoğalması.",
            fullDef: "Geçerli bir hukuki sebep bulunmaksızın bir kişinin malvarlığında diğerinin zararına meydana gelen artış. Zarar gören taraf, iade talebiyle 'sebepsiz zenginleşme davası' açabilir.",
            slug: "sebepsiz-zenginlesme"
        },
        {
            term: "İcazet",
            origin: "Ar. icāzet",
            category: "Medeni Hukuk",
            shortDef: "Onay, izin; yetkisiz temsilcinin yaptığı hukuki işleme temsil olunanın sonradan verdiği onay.",
            fullDef: "Bir kimsenin kendi adına yetkisiz olarak yapılmış bir hukuki işleme sonradan rıza göstermesi, işlemi geçerli kılan sonradan verilen onay beyanı.",
            slug: "icazet"
        },
        {
            term: "Tenfiz",
            origin: "Ar. tenfīz",
            category: "Uluslararası Özel Hukuk",
            shortDef: "Uygulama, yerine getirme; yabancı mahkeme kararının Türkiye'de icra olunabilmesi için verilen mahkeme kararı.",
            fullDef: "Yabancı bir ülke mahkemesince verilmiş ve kesinleşmiş ilamların Türk icra dairelerinde infaz edilebilmesi için yetkili Türk mahkemesinden alınan onay kararı.",
            slug: "tenfiz"
        },
        {
            term: "Tebellüğ",
            origin: "Ar. tebellug",
            category: "Tebligat Hukuku",
            shortDef: "Tebliğ edilen evrakı resmen teslim alma, bildirimden haberdar olma.",
            fullDef: "Kendisine mahkeme, icra dairesi veya resmi merci tarafından tebligat çıkarılan muhatabın bu bildirimi imza karşılığı resmen teslim alması eylemi (Tebliğ eden: Tebliğ memuru; Tebellüğ eden: Muhatap).",
            slug: "tebellug"
        },
        {
            term: "Tebliğ",
            origin: "Ar. teblīg",
            category: "Tebligat Hukuku",
            shortDef: "Hukuki bir işlemin veya kararın yetkili makamca muhatabına usulüne uygun şekilde yazılı olarak bildirilmesi.",
            fullDef: "Mahkeme, savcılık veya resmi kurum işlemlerinin Tebligat Kanunu hükümlerine göre muhatabına resmen bildirilmesi ve hukuki sonuç doğurması işlemi.",
            slug: "teblig"
        },
        {
            term: "Mütekabiliyet",
            origin: "Ar. mutekābiliyet",
            category: "Uluslararası Hukuk",
            shortDef: "Karşılıklılık esası; iki devlet arasındaki hak ve muamelelerin karşılıklı eşitliğe dayanması.",
            fullDef: "Uluslararası hukukta ve yabancılar hukukunda, bir devletin yabancı ülke vatandaşlarına tanıdığı hakların, o yabancı ülkenin de kendi vatandaşlarına aynı hakları tanıması şartına bağlanması ilkesi.",
            slug: "mutekabiliyet"
        },
        {
            term: "İstinaf",
            origin: "Ar. isti'nāf",
            category: "Yargılama Usulü",
            shortDef: "İlk derece mahkemesi kararlarına karşı Bölge Adliye veya Bölge İdare Mahkemelerine başvurulan ikinci derece kanun yolu.",
            fullDef: "İlk derece mahkemelerinin kesin olmayan kararlarına karşı hem maddi vakıa incelemesi hem de hukuki denetim yapılması amacıyla başvurulan olağan kanun yolu.",
            slug: "istinaf"
        },
        {
            term: "Temyiz",
            origin: "Ar. temyīz",
            category: "Yargılama Usulü",
            shortDef: "Bölge Adliye Mahkemesi veya ilk derece kararlarının hukuka uygunluk yönünden Yargıtay veya Danıştay'ca denetlenmesi.",
            fullDef: "İstinaf mahkemelerinin kanunda belirtilen nihai kararlarına karşı yalnızca hukukun yanlış uygulanıp uygulanmadığının denetlenmesi amacıyla Yargıtay veya Danıştay'a başvurulan kanun yolu.",
            slug: "temyiz"
        },
        {
            term: "Müvekkil",
            origin: "Ar. muvekkil",
            category: "Vekalet Hukuku",
            shortDef: "Kendisini temsil etmek üzere bir avukata veya temsilciye vekalet veren kimse.",
            fullDef: "Bir avukata veya vekile kendi adına hukuki işlem yapma, dava açma ve takip etme yetkisi tanıyan gerçek veya tüzel kişi.",
            slug: "muvekkil"
        },
        {
            term: "Şüpheli",
            origin: "Türkçe Hukuk Terimi",
            category: "Ceza Muhakemesi",
            shortDef: "Soruşturma evresinde suç işlediği şüphesi altında bulunan kimse.",
            fullDef: "Ceza Muhakemesi Kanunu uyarınca, yetkili mercilerce suç şüphesinin öğrenilmesinden iddianamenin kabul edilmesine kadar geçen soruşturma evresindeki zanlı kişi.",
            slug: "supheli"
        },
        {
            term: "Sanık",
            origin: "Türkçe Hukuk Terimi",
            category: "Ceza Muhakemesi",
            shortDef: "Hakkında iddianame kabul edilerek kamu davası açılan ve hüküm kesinleşene kadar yargılanan kimse.",
            fullDef: "Kovuşturmanın başlamasından (iddianamenin kabulü) hükmün kesinleşmesine kadar geçen yargılama safhasında suç isnadı altında bulunan kişi.",
            slug: "sanik"
        },
        {
            term: "Katılan",
            origin: "Türkçe Hukuk Terimi",
            category: "Ceza Muhakemesi",
            shortDef: "Suçtan zarar görüp kamu davasına müdahil olarak kabul edilen kişi (eski adıyla müdahil).",
            fullDef: "Mağdur, suçtan zarar gören gerçek veya tüzel kişinin kamu davasına katılma talebinde bulunup mahkemece kabul edilmesiyle ceza yargılamasında taraf sıfatı kazanan kimse.",
            slug: "katilan"
        },
        {
            term: "Mağdur",
            origin: "Ar. magdūr",
            category: "Ceza Hukuku",
            shortDef: "İşlenen suç nedeniyle doğrudan haksızlığa uğrayan, canı veya malı zarar gören kişi.",
            fullDef: "Ceza hukukunda suçun kurucu unsurlarını oluşturan haksız fiilden doğrudan etkilenen, ceza normuyla korunan hukuki menfaati ihlal edilen kişi.",
            slug: "magdur"
        },
        {
            term: "Gıyap",
            origin: "Ar. gıyāb",
            category: "Yargılama Usulü",
            shortDef: "Yokluk, bulunmama; tarafın duruşmada hazır bulunmaması durumu (gıyabında yapılan işlem).",
            fullDef: "Duruşmada hazır bulunmama hali. Tarafın yokluğunda yapılan tebliğ veya yargılama işlemlerini belirtmek için kullanılır (Gıyapta yargılama / Gıyabi tefhim).",
            slug: "giyap"
        },
        {
            term: "İddianame",
            origin: "Ar. iddi'ā + Fars. nāme",
            category: "Ceza Muhakemesi",
            shortDef: "Cumhuriyet savcısının soruşturma sonucunda suç isnadı ve delilleri belirterek kamu davası açtığı belge.",
            fullDef: "Cumhuriyet savcılığınca soruşturma evresi sonunda yeterli suç şüphesine ulaşıldığında mahkemeye sunulan, fiili, faili ve uygulanması istenen kanun maddelerini içeren dava açma belgesi.",
            slug: "iddianame"
        },
        {
            term: "Kovuşturma",
            origin: "Türkçe Hukuk Terimi",
            category: "Ceza Muhakemesi",
            shortDef: "İddianamenin kabulüyle başlayıp hükmün kesinleşmesine kadar mahkemece yürütülen yargılama evresi.",
            fullDef: "Ceza yargılamasında iddianamenin kabulü kararıyla başlayıp duruşmaların yapıldığı ve hükmün kesinleşmesiyle sona eren yargı safhası.",
            slug: "kovusturma"
        },
        {
            term: "Soruşturma",
            origin: "Türkçe Hukuk Terimi",
            category: "Ceza Muhakemesi",
            shortDef: "Suç şüphesinin öğrenilmesinden iddianamenin kabulüne kadar savcılıkça yürütülen araştırma evresi.",
            fullDef: "Kanuna göre yetkili mercilerce suç şüphesinin öğrenilmesinden iddianamenin kabulüne kadar geçen, delillerin toplandığı savcılık evresi.",
            slug: "sorusturma"
        },
        {
            term: "HAGB",
            origin: "Kısaltma",
            category: "Ceza Muhakemesi",
            shortDef: "Hükmün Açıklanmasının Geri Bırakılması; sanık hakkında kurulan mahkûmiyet hükmünün 5 yıl süreyle infaz edilmeyip askıya alınması.",
            fullDef: "Sanık hakkında hükmolunan 2 yıl veya daha az süreli hapis ya da adli para cezasının, kanuni koşulların varlığı halinde açıklanmayarak sanığın 5 yıllık denetim süresine tabi tutulması kurumu.",
            slug: "hagb"
        },
        {
            term: "Takipsizlik",
            origin: "Türkçe Hukuk Terimi",
            category: "Ceza Muhakemesi",
            shortDef: "Kovuşturmaya Yer Olmadığına Dair Karar (KYOK); savcılığın kamu davası açılmasına yer görmemesi.",
            fullDef: "Cumhuriyet savcısının soruşturma neticesinde kamu davası açmaya yeterli delil bulunmaması veya kovuşturma olanağının kalmaması sebebiyle kamu davası açmama kararı.",
            slug: "takipsizlik-kyok"
        },
        {
            term: "Yetkisizlik",
            origin: "Türkçe Hukuk Terimi",
            category: "Yargılama Usulü",
            shortDef: "Uyuşmazlığa coğrafi (yer) bakımından bakma yetkisinin başka bir yer mahkemesine ait olması.",
            fullDef: "Davanın açıldığı mahkemenin yer itibarıyla yetkili olmaması sebebiyle dosyanın yetkili yer mahkemesine gönderilmesi yönünde verilen usul kararı.",
            slug: "yetkisizlik"
        },
        {
            term: "Görevsizlik",
            origin: "Türkçe Hukuk Terimi",
            category: "Yargılama Usulü",
            shortDef: "Davanın konusu itibarıyla o mahkemenin görev alanına girmeyip başka bir mahkemenin görevine girmesi.",
            fullDef: "Mahkemelerin görev alanlarının kamu düzenine ilişkin olması sebebiyle, davanın türüne göre başka mahkemece (ör. Sulh Hukuk yerine Asliye Hukuk) bakılması gerektiği kararı.",
            slug: "gorevsizlik"
        },
        {
            term: "İhtiyati Tedbir",
            origin: "Ar. ihtiyātī + tedbīr",
            category: "Medeni Usul Hukuku",
            shortDef: "Dava konusu hakkın elde edilmesini güvence altına almak için mahkemece verilen geçici hukuki koruma.",
            fullDef: "Gecikmesinde sakınca bulunan veya telafisi imkânsız zararlar doğurabilecek durumlarda, uyuşmazlık konusu hakkında hüküm kesinleşinceye kadar verilen geçici tedbir kararı.",
            slug: "ihtiyati-tedbir"
        },
        {
            term: "İhtiyati Haciz",
            origin: "Ar. ihtiyātī + haciz",
            category: "İcra ve İflas Hukuku",
            shortDef: "Para borcunun ödenmesini garantiye almak amacıyla borçlunun mallarına tedbiren el konulması.",
            fullDef: "Rehinle temin edilmemiş ve vadesi gelmiş para borçlarında alacaklının talebi üzerine mahkemece borçlunun yedindeki mallara uygulanan geçici haciz işlemi.",
            slug: "ihtiyati-haciz"
        },
        {
            term: "Defi",
            origin: "Ar. def'",
            category: "Medeni Usul & Borçlar",
            shortDef: "Davalının borcun varlığını inkar etmeksizin, özel bir sebebe dayanarak borcu ifa etmekten kaçınması (ör. zamanaşımı defi).",
            fullDef: "Davalının davacının hakkını kabul etmesine rağmen kanundan kaynaklanan özel bir hakka (örneğin zamanaşımı, takas vb.) dayanarak borcu ödemekten kaçınma savunması.",
            slug: "defi"
        },
        {
            term: "İkrar",
            origin: "Ar. ikrār",
            category: "Usul & İspat Hukuku",
            shortDef: "Karşı tarafça ileri sürülen ve kendi aleyhine olan maddi vakıanın doğruluğunu mahkemede kabul etme.",
            fullDef: "Yargılama esnasında taraflardan birinin, karşı tarafça ileri sürülen aleyhindeki vakıanın doğru olduğunu kabul etmesi. İkrar edilen vakıalar çekişmeli olmaktan çıkar ve ispat gerektirmez.",
            slug: "ikrar"
        },
        {
            term: "İstirdat",
            origin: "Ar. istirdād",
            category: "İcra ve İflas Hukuku",
            shortDef: "Geri alma; cebri icra tehdidi altında haksız olarak ödenmek zorunda kalınan paranın geri alınması davası.",
            fullDef: "Borçlu olmadığı halde icra takibi baskısı altında parayı ödemek zorunda kalan kimsenin, ödediği parayı geri almak amacıyla açtığı dava (İstirdat davası).",
            slug: "istirdat"
        },
        {
            term: "Menfi Tespit",
            origin: "Ar. menfī + tesbīt",
            category: "İcra ve İflas Hukuku",
            shortDef: "Borçlu olunmadığının mahkeme kararıyla tespiti amacıyla icra takibinden önce veya sonra açılan dava.",
            fullDef: "Gerçekte borçlu olmadığını iddia eden kişinin, alacaklı tarafından haksız yere icra takibine maruz kalmasını önlemek veya takibi sonuçsuz bırakmak için açtığı borçsuzluk tespit davası.",
            slug: "menfi-tespit"
        },
        {
            term: "Tehir-i İcra",
            origin: "Ar. te'hīr + icrā",
            category: "İcra ve İflas Hukuku",
            shortDef: "İcranın geri bırakılması; mahkeme kararı istinaf veya temyiz edilirken teminat yatırılarak icranın durdurulması.",
            fullDef: "Aleyhine ilamlı icra takibi başlatılan borçlunun, üst mahkemeye başvurarak icra veznesine teminat yatırması karşılığında üst mahkeme karar verene kadar takibin durdurulması kararı.",
            slug: "tehir-i-icra"
        },
        {
            term: "Şufa",
            origin: "Ar. şuf'a",
            category: "Eşya Hukuku",
            shortDef: "Önalım hakkı; paylı mülkiyette paydaşlardan birinin payını üçüncü kişiye satması halinde diğer paydaşların öncelikle satın alma hakkı.",
            fullDef: "Paylı mülkiyete tabi taşınmazlarda bir paydaşın payını satması durumunda diğer hissedarlara tanınan öncelikli satın alma yenilik doğuran hakkı.",
            slug: "sufa"
        },
        {
            term: "Muris",
            origin: "Ar. mūrith",
            category: "Miras Hukuku",
            shortDef: "Mirasbırakan; vefatıyla malvarlığı mirasçılarına intikal eden kimse.",
            fullDef: "Ölümü veya gaipliğine karar verilmesiyle birlikte hak ve borçları yasal veya atanmış mirasçılarına geçen gerçek kişi.",
            slug: "muris"
        },
        {
            term: "Mirasçı",
            origin: "Türkçe Hukuk Terimi",
            category: "Miras Hukuku",
            shortDef: "Mirasbırakanın vefatı ile onun terekesine kanun veya vasiyet gereği halef olan kimse.",
            fullDef: "Mirasbırakanın ölümüyle birlikte geride bıraktığı hak ve borçlara külli halefiyet ilkesi uyarınca sahip olan hak sahibi.",
            slug: "mirasci"
        },
        {
            term: "Tereke",
            origin: "Ar. tereke",
            category: "Miras Hukuku",
            shortDef: "Mirasbırakanın vefatı ile geride bıraktığı tüm aktif ve pasif malvarlığı değerleri, hak ve borçlar bütünü.",
            fullDef: "Mirasbırakanın ölümü anında mevcut olan, para ile ölçülebilen mal, hak, alacak ve borçlarının tamamını kapsayan hukuki malvarlığı bütünü.",
            slug: "tereke"
        },
        {
            term: "Vasiyet",
            origin: "Ar. vaṣiyyet",
            category: "Miras Hukuku",
            shortDef: "Bir kimsenin ölümünden sonra sonuç doğurmak üzere malvarlığı hakkında yaptığı tek taraflı irade beyanı.",
            fullDef: "Kişinin ölümünden sonra malvarlığının paylaşımı veya mirasçı atanması konusunda kanunun aradığı şekil şartlarına uygun olarak yaptığı ölüme bağlı tasarruf.",
            slug: "vasiyet"
        },
        {
            term: "Vesayet",
            origin: "Ar. veṣāyet",
            category: "Aile Hukuku",
            shortDef: "Velayet altında bulunmayan küçüklerin ve kısıtlanan erginlerin haklarının mahkemece koruma altına alınması düzeni.",
            fullDef: "Ana babasının velayeti altında bulunmayan küçükler ile akıl hastalığı, savurganlık vb. sebeplerle kısıtlanan kişilerin şahsi ve mali haklarını korumak üzere vesayet makamınca yürütülen hukuki kurum.",
            slug: "vesayet"
        },
        {
            term: "Kayyım",
            origin: "Ar. kayyim",
            category: "Aile & Şirketler Hukuku",
            shortDef: "Belirli bir hukuki işi yürütmek veya bir malvarlığını yönetmek üzere mahkemece tayin edilen görevli kimse.",
            fullDef: "Vesayetten farklı olarak sürekli değil, belirli bir işin ifası veya temsili (temsil kayyımı) ya da malvarlığının yönetimi (yönetim kayyımı) amacıyla atanan geçici hukuki temsilci.",
            slug: "kayyim"
        },
        {
            term: "Tevdi",
            origin: "Ar. tevdī'",
            category: "Yargılama Usulü",
            shortDef: "Emanet etme, teslim etme; evrakın veya dava dosyasının resmi bir kuruma veya merciye verilmesi.",
            fullDef: "Dava dosyasının, bilirkişi raporunun veya bir delilin incelenmek veya gereği yapılmak üzere ilgili daireye, kurula veya bilirkişiye resmi olarak teslim edilmesi işlemi.",
            slug: "tevdi"
        },
        {
            term: "Tevzi",
            origin: "Ar. tevzī'",
            category: "Adliye Teşkilatı",
            shortDef: "Dağıtma, paylaştırma; adliyeye gelen dava ve işlerin mahkemeler arasında adil ve eşit şekilde paylaştırılması.",
            fullDef: "Adliyelerde açılan yeni dava ve icra takip dosyalarının, iş yükü dengesi gözetilerek sistem (UYAP) tarafından ilgili mahkemelere otomatik olarak dağıtılması işlemi.",
            slug: "tevzi"
        },
        {
            term: "Kabul",
            origin: "Ar. kabūl",
            category: "Medeni Usul Hukuku",
            shortDef: "Davalının, davacının talep sonucuna kısmen veya tamamen rıza göstermesi hali.",
            fullDef: "Hukuk muhakemesinde davalının, davacının dava dilekçesindeki talep sonucunun haklı olduğunu kabul etmesi. Kabul ile dava kısmen veya tamamen son bulur.",
            slug: "kabul"
        },
        {
            term: "Feragat",
            origin: "Ar. ferāgat",
            category: "Medeni Usul Hukuku",
            shortDef: "Davacının talep sonucundan kısmen veya tamamen vazgeçmesi beyanı.",
            fullDef: "Davacının mahkemeye yapacağı tek taraflı irade beyanıyla, açtığı davadaki talep hakkından kesin olarak vazgeçmesi. Feragat karşı tarafın rızasına bağlı değildir ve kesin hüküm doğurur.",
            slug: "feragat"
        },
        {
            term: "Sulh",
            origin: "Ar. ṣulḥ",
            category: "Medeni Usul Hukuku",
            shortDef: "Uyuşmazlık taraflarının karşılıklı fedakarlıkta bulunarak aralarındaki davayı anlaşmayla sonlandırmaları.",
            fullDef: "Mahkeme huzurunda tarafların karşılıklı tavizlerle uyuşmazlığa son vermeleri hali. Mahkemece tasdik edilen mahkeme içi sulh, kesin hüküm ve ilam niteliğindedir.",
            slug: "sulh"
        },
        {
            term: "İnfaz",
            origin: "Ar. infāz",
            category: "Ceza & İcra Hukuku",
            shortDef: "Kesinleşmiş mahkeme kararının veya cezanın yetkili makamlarca yerine getirilmesi, icra edilmesi.",
            fullDef: "Hükmün kesinleşmesinden sonra cezanın ceza infaz kurumunda çektirilmesi ya da hukuk mahkemesi ilamının icra dairesince fiilen uygulanması süreci.",
            slug: "infaz"
        },
        {
            term: "Mütekabil",
            origin: "Ar. mutekābil",
            category: "Yargılama Usulü",
            shortDef: "Karşılıklı olan; mütekabil dava (davalının davacıya karşı aynı dosyada açtığı karşı dava).",
            fullDef: "Hukuk muhakemesinde karşılıklı dava veya iddia ilişkisini ifade eder. En yaygın kullanımı davalının açtığı 'karşı dava' (mütekabil dava) bağlamındadır.",
            slug: "mutekabil"
        },
        {
            term: "İcbar",
            origin: "Ar. icbār",
            category: "Ceza Hukuku",
            shortDef: "Zorlama, mecbur bırakma; irtikap suçunda kamu görevlisinin yetkisini kötüye kullanarak kişiyi zorlaması.",
            fullDef: "Kişinin iradesi üzerinde baskı kurarak onu istemediği bir hukuki işlemi yapmaya veya menfaat temin etmeye zorlama eylemi.",
            slug: "icbar"
        },
        {
            term: "İstihkak",
            origin: "Ar. istiḥkāk",
            category: "İcra ve İflas Hukuku",
            shortDef: "Hak sahipliği; haczedilen bir mal üzerinde borçlu dışındaki üçüncü kişinin mülkiyet veya rehin hakkı iddiası.",
            fullDef: "Hacizli malın borçluya değil kendisine ait olduğunu ileri süren üçüncü kişinin açtığı mülkiyetin tespiti ve haczin kaldırılması davası (İstihkak davası).",
            slug: "istihkak"
        },
        {
            term: "İzale-i Şüyu",
            origin: "Ar. izāle-i şuyū'",
            category: "Medeni Hukuk",
            shortDef: "Ortaklığın giderilmesi; paylı veya elbirliği mülkiyetindeki malın paydaşlar arasında paylaştırılması veya satışı davası.",
            fullDef: "Taşınır veya taşınmaz mallardaki paydaşlığın aynen taksim (bölüşme) yahut mahkemece icra yoluyla satış suretiyle sona erdirilmesi amacıyla açılan dava.",
            slug: "izale-i-suyu"
        },
        {
            term: "Zilyetlik",
            origin: "Ar. zū'l-yed",
            category: "Eşya Hukuku",
            shortDef: "Bir şey üzerindeki fiili hakimiyet; mülkiyetten bağımsız olarak eşyayı elinde bulundurma durumu.",
            fullDef: "Kişinin bir taşınır veya taşınmaz eşya üzerinde fiili egemenliğe sahip olması hali. Zilyet mülkiyet sahibi olabileceği gibi kiracı veya ödünç alan da olabilir.",
            slug: "zilyetlik"
        },
        {
            term: "Semere",
            origin: "Ar. s̱emere",
            category: "Medeni Hukuk",
            shortDef: "Ürün, gelir; bir şeyin dönemsel olarak getirdiği doğal veya hukuki gelir (ör. kira geliri, faiz, meyve).",
            fullDef: "Eşyanın özüne zarar vermeksizin elde edilen dönemsel ürünler (tabii semere) ile bir hukuki ilişki neticesinde elde edilen gelirler (medeni/hukuki semere).",
            slug: "semere"
        },
        {
            term: "Dergurur",
            origin: "Ar. der + gurūr",
            category: "Eski Adli Istılah",
            shortDef: "Aldanma, yanılgı içinde bulunma; gaflet veya yanıltılma sonucu oluşan hata hali.",
            fullDef: "Eski mahkeme kararlarında ve Osmanlı hukuku metinlerinde tarafların bir hususta aldatıldığını veya bilgisizlik/gaflet yüzünden yanılgıya düştüğünü ifade eden tabir.",
            slug: "dergurur"
        }
    ];

    // Slug ve Normalleştirilmiş Arama Tablosu
    const NORMALIZED_MAP = new Map();

    function normalizeTurkish(str) {
        if (!str) return '';
        return String(str)
            .toLowerCase()
            .replace(/[âäá]/g, 'a')
            .replace(/[îíï]/g, 'i')
            .replace(/[ûúü]/g, 'u')
            .replace(/[ç]/g, 'c')
            .replace(/[ğ]/g, 'g')
            .replace(/[ıİ]/g, 'i')
            .replace(/[ö]/g, 'o')
            .replace(/[ş]/g, 's')
            .replace(/[^a-z0-9]/g, '');
    }

    // Ekleri ayıklama (Türkçe çekim ekleri: -nin, -ye, -den, -de, -i, -e, -in, -ler, -ce, vb.)
    const SUFFIXES = [
        'lerinin', 'lerinden', 'lerine', 'leriyle', 'lerin', 'lerde', 'ler', 'lar',
        'ın', 'in', 'un', 'ün', 'nın', 'nin', 'nun', 'nün',
        'a', 'e', 'ya', 'ye', 'da', 'de', 'ta', 'te',
        'dan', 'den', 'tan', 'ten',
        'ı', 'i', 'u', 'ü', 'yı', 'yi', 'yu', 'yü',
        'li', 'lı', 'lu', 'lü', 'siz', 'sız', 'suz', 'süz',
        'ce', 'ca', 'çe', 'ça'
    ];

    // Veritabanını haritaya işle
    TERMS_DB.forEach(item => {
        const norm = normalizeTurkish(item.term);
        NORMALIZED_MAP.set(norm, item);

        // Özel çok kelimeli veya tireli terimler
        if (item.term.includes(' ')) {
            const words = item.term.split(' ').map(normalizeTurkish).join('');
            NORMALIZED_MAP.set(words, item);
        }
    });

    /**
     * Verilen kelimeyi veya ifadeyi sözlükte arar
     */
    function lookupIn(map, word) {
        if (!word || typeof word !== 'string') return null;
        const clean = normalizeTurkish(word.trim());
        if (!clean || clean.length < 3) return null;

        // Doğrudan tam eşleşme
        if (map.has(clean)) {
            return map.get(clean);
        }

        // Ek ayıklama ile kök eşleşmesi
        for (let i = 0; i < SUFFIXES.length; i++) {
            const suf = SUFFIXES[i];
            if (clean.length > suf.length + 3 && clean.endsWith(suf)) {
                const stem = clean.slice(0, -suf.length);
                if (map.has(stem)) {
                    return map.get(stem);
                }
            }
        }

        return null;
    }

    // 657.com.tr sözlüğünden gelen terimler (genel Türkçe sözcükler de içerir): yalnızca bilinçli aramalarda kullanılır
    const MAP_657 = new Map();

    /**
     * Terim arar. Varsayılan: yalnızca özenle seçilmiş hukuk terimleri (üzerine gelince ipucu için).
     * deep=true: 657.com.tr sözlüğündeki binlerce terim de aranır (sağ tık "Ne Demek?", sözlük penceresi).
     */
    function lookup(word, deep) {
        return lookupIn(NORMALIZED_MAP, word) || (deep ? lookupIn(MAP_657, word) : null);
    }

    const DATA_657_URL = 'assets/data/sozluk-657.json';
    let loaded657 = false;
    function load657() {
        if (loaded657) return;
        loaded657 = true;
        fetch(DATA_657_URL).then((r) => (r.ok ? r.json() : [])).then((rows) => {
            rows.forEach((r) => {
                const item = { term: r[0], slug: r[1], shortDef: r[2], fullDef: '', origin: '', category: 'Hukuk Sözlüğü', src657: true };
                const norm = normalizeTurkish(item.term);
                if (NORMALIZED_MAP.has(norm)) return; // özenle yazılmış kayıt öncelikli
                if (!MAP_657.has(norm)) MAP_657.set(norm, item);
                TERMS_DB.push(item);
            });
            if (modalEl && modalEl.style.display !== 'none') filterTerms();
        }).catch(() => { loaded657 = false; });
    }

    /**
     * 657.com.tr üzerindeki sözlük URL'sini üretir
     */
    // Belgeden seçilen metin güvenilmezdir: HTML'e yazılırken kaçışlanır, eylemler veri niteliğiyle bağlanır
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function bindOpenTerm(root) {
        root.querySelectorAll('[data-open-term]').forEach((el) => {
            el.addEventListener('click', () => window.UkiDictionary.openModal(el.getAttribute('data-open-term')));
        });
    }

    // 657.com.tr kelime sayfası: https://657.com.tr/kelime/<kelime>-ne-demek/
    function slug657(term) {
        const map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i̇': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
        return String(term || '')
            .replace(/İ/g, 'i').replace(/I/g, 'ı')
            .toLowerCase()
            .replace(/[çğıöşüâîû]|i̇/g, (c) => map[c] || c)
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function get657Url(termObjOrWord) {
        if (!termObjOrWord) return 'https://657.com.tr/hukuk-sozlugu/';
        const slug = (typeof termObjOrWord === 'object' && termObjOrWord.slug)
            ? termObjOrWord.slug
            : slug657(typeof termObjOrWord === 'object' ? termObjOrWord.term : termObjOrWord);
        if (!slug) return 'https://657.com.tr/hukuk-sozlugu/';
        // 657.com.tr kayıtlarında slug zaten "-ne-demek" ile biter; özenle yazılmış kayıtlarda eklenir
        const full = /-ne-demek$/.test(slug) ? slug : slug + '-ne-demek';
        return `https://657.com.tr/kelime/${full}/`;
    }

    // --------------------------------------------------------------------------
    // UI: HOVER BİLGİ KARTI (FLOATING POPOVER)
    // --------------------------------------------------------------------------
    let tooltipEl = null;
    let tooltipTimer = null;
    let isMouseOverTooltip = false;

    function createTooltip() {
        if (tooltipEl) return;
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'uki-dict-tooltip';
        tooltipEl.className = 'uki-dict-tooltip';
        tooltipEl.setAttribute('role', 'tooltip');
        tooltipEl.innerHTML = '';
        document.body.appendChild(tooltipEl);

        tooltipEl.addEventListener('mouseenter', () => {
            isMouseOverTooltip = true;
            if (tooltipTimer) clearTimeout(tooltipTimer);
        });

        tooltipEl.addEventListener('mouseleave', () => {
            isMouseOverTooltip = false;
            hideTooltip();
        });
    }

    function showTooltip(termObj, x, y) {
        if (!termObj) return;
        createTooltip();

        const url = get657Url(termObj);

        tooltipEl.innerHTML = `
            <div class="dict-tip-header">
                <div class="dict-tip-title-wrap">
                    <span class="dict-tip-badge">⚖️ HUKUK SÖZLÜĞÜ</span>
                    <strong class="dict-tip-term">${termObj.term}</strong>
                    ${termObj.origin ? `<span class="dict-tip-origin">(${termObj.origin})</span>` : ''}
                </div>
                <span class="dict-tip-cat">${termObj.category}</span>
            </div>
            <div class="dict-tip-body">
                <p class="dict-tip-short">${termObj.shortDef}</p>
            </div>
            <div class="dict-tip-footer">
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="dict-tip-link-btn" title="657.com.tr'de geniş tanımını görüntüle">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    657.com.tr Sözlük'te Gör ↗
                </a>
                <button type="button" class="dict-tip-detail-btn" data-open-term="${esc(termObj.term)}">
                    Detaylı İncele
                </button>
            </div>
        `;

        bindOpenTerm(tooltipEl);

        // Kapatma düğmesi: "Sözlük ipuçlarını kapat"
        const head = tooltipEl.querySelector('.dict-tip-header');
        if (head) {
            const off = document.createElement('button');
            off.type = 'button';
            off.className = 'dict-tip-off';
            off.title = 'Sözlük ipuçlarını kapat (Araçlar menüsünden yeniden açılır)';
            off.setAttribute('aria-label', 'Sözlük ipuçlarını kapat');
            off.textContent = '×';
            off.addEventListener('click', (e) => { e.stopPropagation(); setHoverEnabled(false, true); });
            head.appendChild(off);
        }

        // Konumlandırma
        tooltipEl.style.display = 'block';
        const tipRect = tooltipEl.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let left = x + 8;
        let top = y + 18;

        if (left + tipRect.width > winWidth - 16) {
            left = winWidth - tipRect.width - 16;
        }
        if (top + tipRect.height > winHeight - 16) {
            top = y - tipRect.height - 10;
        }

        tooltipEl.style.left = `${Math.max(10, left)}px`;
        tooltipEl.style.top = `${Math.max(10, top)}px`;
        tooltipEl.classList.add('visible');
    }

    function hideTooltip(immediate = false) {
        if (!tooltipEl) return;
        if (immediate) {
            tooltipEl.style.display = 'none';
            tooltipEl.classList.remove('visible');
            return;
        }
        if (tooltipTimer) clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(() => {
            if (!isMouseOverTooltip && tooltipEl) {
                tooltipEl.style.display = 'none';
                tooltipEl.classList.remove('visible');
            }
        }, 180);
    }

    // --------------------------------------------------------------------------
    // UI: SAĞ TIK ÖZEL BAĞLAM MENÜSÜ (CUSTOM CONTEXT MENU)
    // --------------------------------------------------------------------------
    let contextMenuEl = null;

    function createContextMenu() {
        if (contextMenuEl) return;
        contextMenuEl = document.createElement('div');
        contextMenuEl.id = 'uki-dict-contextmenu';
        contextMenuEl.className = 'uki-dict-contextmenu';
        contextMenuEl.style.display = 'none';
        document.body.appendChild(contextMenuEl);

        // Dışarı tıklandığında kapat
        window.addEventListener('click', () => hideContextMenu());
        window.addEventListener('scroll', () => hideContextMenu(), true);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideContextMenu();
        });
    }

    function showContextMenu(e, clickedWord, termObj) {
        createContextMenu();
        hideTooltip(true);

        const word = (clickedWord || '').trim();
        const url = get657Url(termObj || word);

        let menuHtml = '';

        if (termObj) {
            menuHtml = `
                <div class="dict-cm-header">
                    <span class="dict-cm-tag">⚖️ 657.com.tr Hukuk Sözlüğü</span>
                    <strong class="dict-cm-term">"${termObj.term}" Ne Demek?</strong>
                </div>
                <div class="dict-cm-snippet">${termObj.shortDef}</div>
                <div class="dict-cm-divider"></div>
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="dict-cm-item primary-action">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    <span>657.com.tr'de Sayfayı Aç ↗</span>
                </a>
                <div class="dict-cm-item" data-open-term="${esc(termObj.term)}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    <span>Sözlükte İncele &amp; Tanımı Kopyala</span>
                </div>
            `;
        } else if (word && word.length >= 2) {
            menuHtml = `
                <div class="dict-cm-header">
                    <span class="dict-cm-tag">⚖️ 657.com.tr Sözlük</span>
                    <strong class="dict-cm-term">"${esc(word)}"</strong>
                </div>
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="dict-cm-item primary-action">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span>657.com.tr'de Terimi Ara ↗</span>
                </a>
                <div class="dict-cm-item" data-open-term="${esc(word)}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    <span>Hukuk Sözlüğü'nde Ara (Alt+S)</span>
                </div>
            `;
        } else {
            menuHtml = `
                <div class="dict-cm-item" onclick="window.UkiDictionary.openModal()">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    <span>Hukuki Terimler Sözlüğü (657.com.tr)</span>
                </div>
            `;
        }

        // Standart hızlı düzenleme eylemleri
        menuHtml += `
            <div class="dict-cm-divider"></div>
            <div class="dict-cm-item" onclick="document.execCommand('copy')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Kopyala</span>
                <kbd>Ctrl+C</kbd>
            </div>
            <div class="dict-cm-item" onclick="document.getElementById('tab-btn-find').click(); document.getElementById('btn-find-replace') && document.getElementById('btn-find-replace').click()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span>Bul ve Değiştir...</span>
                <kbd>Ctrl+F</kbd>
            </div>
        `;

        contextMenuEl.innerHTML = menuHtml;
        bindOpenTerm(contextMenuEl);
        contextMenuEl.style.display = 'block';

        const cmRect = contextMenuEl.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let left = e.clientX;
        let top = e.clientY;

        if (left + cmRect.width > winWidth - 10) {
            left = winWidth - cmRect.width - 10;
        }
        if (top + cmRect.height > winHeight - 10) {
            top = winHeight - cmRect.height - 10;
        }

        contextMenuEl.style.left = `${Math.max(10, left)}px`;
        contextMenuEl.style.top = `${Math.max(10, top)}px`;
    }

    function hideContextMenu() {
        if (contextMenuEl) {
            contextMenuEl.style.display = 'none';
        }
    }

    // --------------------------------------------------------------------------
    // FARE İLE SÖZCÜK TESPİTİ (CARETRANGEFROMPOINT)
    // --------------------------------------------------------------------------
    function getWordAtPoint(x, y) {
        let range = null;
        let textNode = null;
        let offset = 0;

        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(x, y);
            if (range) {
                textNode = range.startContainer;
                offset = range.startOffset;
            }
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y);
            if (pos) {
                textNode = pos.offsetNode;
                offset = pos.offset;
            }
        }

        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

        const text = textNode.nodeValue;
        if (!text) return null;

        // Kelime sınırlarını bul (Türkçe karakterleri ve tireyi içeren)
        const isWordChar = (ch) => /[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû0-9\-]/.test(ch);

        let start = offset;
        let end = offset;

        while (start > 0 && isWordChar(text[start - 1])) {
            start--;
        }
        while (end < text.length && isWordChar(text[end])) {
            end++;
        }

        const word = text.slice(start, end).trim();
        return word.length >= 2 ? word : null;
    }

    // --------------------------------------------------------------------------
    // ETKİLEŞİM VE DİNLENEN OLAYLAR
    // --------------------------------------------------------------------------
    let hoverDebounceTimer = null;

    // Üzerine gelince açılan sözlük ipuçları kapatılabilir (tercih tarayıcıda saklanır)
    const HOVER_KEY = 'uki-dict-hover';
    let hoverEnabled = true;
    try { hoverEnabled = localStorage.getItem(HOVER_KEY) !== 'off'; } catch (e) { /* depolama kapalı: açık kalır */ }

    function setHoverEnabled(on, notify) {
        hoverEnabled = !!on;
        try { localStorage.setItem(HOVER_KEY, hoverEnabled ? 'on' : 'off'); } catch (e) { /* saklanamadı */ }
        if (!hoverEnabled) {
            if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
            hideTooltip(true);
        }
        if (notify && window.showToast) {
            window.showToast(hoverEnabled
                ? 'Sözlük ipuçları açıldı: terimlerin üzerine gelince açıklama görünür.'
                : 'Sözlük ipuçları kapatıldı. Araçlar > Sözlük ipuçları ile yeniden açabilirsiniz.', 'info');
        }
        window.dispatchEvent(new CustomEvent('uki-dict-hover-changed', { detail: hoverEnabled }));
    }

    function attachListeners() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        // 1. Hover Takibi (Mousemove debounced)
        editor.addEventListener('mousemove', (e) => {
            if (!hoverEnabled) return;
            if (isMouseOverTooltip) return;

            if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
            hoverDebounceTimer = setTimeout(() => {
                const word = getWordAtPoint(e.clientX, e.clientY);
                if (!word) {
                    hideTooltip();
                    return;
                }

                const termObj = lookup(word);
                if (termObj) {
                    showTooltip(termObj, e.clientX, e.clientY);
                } else {
                    hideTooltip();
                }
            }, 200);
        });

        editor.addEventListener('mouseleave', () => {
            if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
            hideTooltip();
        });

        // 2. Sağ Tuş Bağlam Menüsü (Context Menu)
        editor.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            // Önce seçili metne bak
            let selectedText = '';
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) {
                selectedText = sel.toString().trim();
            }

            // Seçim yoksa tıklanan kelimeyi al
            const targetWord = selectedText || getWordAtPoint(e.clientX, e.clientY) || '';
            const termObj = lookup(targetWord, true);

            showContextMenu(e, targetWord, termObj);
        });
    }

    // --------------------------------------------------------------------------
    // UI: TAM HUKUKİ TERİMLER SÖZLÜĞÜ MODALI (SEARCH & DETAIL MODAL)
    // --------------------------------------------------------------------------
    let modalEl = null;

    function createModal() {
        if (modalEl) return;
        modalEl = document.getElementById('modal-legal-dictionary');
        if (modalEl) return;

        modalEl = document.createElement('div');
        modalEl.id = 'modal-legal-dictionary';
        modalEl.className = 'ax-modal-backdrop';
        modalEl.style.display = 'none';

        modalEl.innerHTML = `
            <div class="ax-modal-dialog dict-modal-dialog" style="max-width: 680px;">
                <div class="ax-modal-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="13" y2="11"/></svg>
                        <h3>Hukuki Terimler Sözlüğü (657.com.tr)</h3>
                    </div>
                    <button type="button" class="ax-modal-close" onclick="window.UkiDictionary.closeModal()">&times;</button>
                </div>
                <div class="ax-modal-body" style="padding: 16px;">
                    <div class="dict-search-bar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="dict-search-input" placeholder="Hukuki terim veya kavram arayın (Müşteki, Müdafi, Bidayet, Tevellüt, İctinap...)" autocomplete="off">
                        <span id="dict-result-count" class="dict-result-count">${TERMS_DB.length} terim</span>
                    </div>

                    <div class="dict-quick-chips" id="dict-quick-chips">
                        <button type="button" class="dict-chip active" data-cat="all">Tümü</button>
                        <button type="button" class="dict-chip" data-cat="Ceza Muhakemesi">Ceza Muhakemesi</button>
                        <button type="button" class="dict-chip" data-cat="Yargılama Usulü">Yargılama Usulü</button>
                        <button type="button" class="dict-chip" data-cat="İcra ve İflas Hukuku">İcra &amp; İflas</button>
                        <button type="button" class="dict-chip" data-cat="Medeni Hukuk">Medeni Hukuk</button>
                        <button type="button" class="dict-chip" data-cat="Tebligat Hukuku">Tebligat</button>
                        <button type="button" class="dict-chip" data-cat="Hukuk Sözlüğü">657.com.tr Sözlük</button>
                    </div>

                    <div class="dict-terms-list" id="dict-terms-list">
                        <!-- Terim kartları dinamik yüklenir -->
                    </div>
                </div>
                <div class="ax-modal-footer" style="justify-content: space-between;">
                    <div style="font-size: 11.5px; color: var(--ax-color-neutral-600); display: flex; align-items: center; gap: 6px;">
                        <span>📚 Kaynak: <strong>657.com.tr Adalet &amp; Hukuk Platformu</strong></span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <a href="https://657.com.tr/hukuk-sozlugu/" target="_blank" rel="noopener noreferrer" class="tool-btn-secondary" style="display: inline-flex; align-items: center; gap: 5px; text-decoration: none;">
                            <span>657.com.tr Sözlük Portalı ↗</span>
                        </a>
                        <button type="button" class="tool-btn-primary" onclick="window.UkiDictionary.closeModal()">Kapat</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        // Arama ve filtre dinleyicileri
        const searchInput = document.getElementById('dict-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => filterTerms());
        }

        const chips = modalEl.querySelectorAll('.dict-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                filterTerms();
            });
        });
    }

    function renderTerms(list) {
        const container = document.getElementById('dict-terms-list');
        const countBadge = document.getElementById('dict-result-count');
        if (!container) return;

        if (countBadge) {
            countBadge.textContent = `${list.length} terim`;
        }

        if (list.length === 0) {
            const query = (document.getElementById('dict-search-input') || {}).value || '';
            container.innerHTML = `
                <div class="dict-empty-state">
                    <p>Aradığınız terim yerel sözlükte bulunamadı.</p>
                    <a href="${get657Url(query)}" target="_blank" rel="noopener noreferrer" class="tool-btn-primary" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; margin-top: 8px;">
                        🔍 "${esc(query)}" terimini 657.com.tr'de Canlı Ara ↗
                    </a>
                </div>
            `;
            return;
        }

        // Binlerce terim olabilir: ilk 60 sonuç gösterilir, gerisi "Daha fazla göster" ile açılır
        const limit = renderLimit;
        const shown = list.slice(0, limit);
        let html = '';
        shown.forEach((item, idx) => {
            const url = get657Url(item);
            html += `
                <div class="dict-card-item">
                    <div class="dict-card-top">
                        <div class="dict-card-title-group">
                            <span class="dict-card-term">${esc(item.term)}</span>
                            ${item.origin ? `<span class="dict-card-origin">${esc(item.origin)}</span>` : ''}
                            <span class="dict-card-cat-tag">${esc(item.category)}</span>
                        </div>
                        <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="dict-card-outlink" title="657.com.tr üzerinde aç">
                            657.com.tr ↗
                        </a>
                    </div>
                    <div class="dict-card-def">${esc(item.shortDef)}</div>
                    ${item.fullDef ? `<div class="dict-card-detail">${esc(item.fullDef)}</div>` : ''}
                    <div class="dict-card-actions">
                        <button type="button" class="dict-card-btn-copy" data-idx="${idx}">
                            📋 Tanımı Kopyala
                        </button>
                    </div>
                </div>
            `;
        });
        if (list.length > limit) {
            html += `<button type="button" class="tool-btn-secondary dict-more-btn">Daha fazla göster (${list.length - limit} terim daha)</button>`;
        }

        container.innerHTML = html;
        container.querySelectorAll('.dict-card-btn-copy').forEach((btn) => {
            btn.addEventListener('click', () => {
                const it = shown[parseInt(btn.getAttribute('data-idx'), 10)];
                if (it) copyDef(it.term, it.shortDef);
            });
        });
        const more = container.querySelector('.dict-more-btn');
        if (more) more.addEventListener('click', () => { renderLimit += 120; renderTerms(list); });
    }

    let renderLimit = 60;

    function filterTerms() {
        const searchInput = document.getElementById('dict-search-input');
        const query = searchInput ? normalizeTurkish(searchInput.value.trim()) : '';

        const activeChip = modalEl ? modalEl.querySelector('.dict-chip.active') : null;
        const selectedCat = activeChip ? activeChip.getAttribute('data-cat') : 'all';

        const filtered = TERMS_DB.filter(item => {
            // Kategori kontrolü
            if (selectedCat !== 'all' && item.category !== selectedCat) {
                return false;
            }
            // Arama sorgusu kontrolü
            if (query) {
                const termNorm = normalizeTurkish(item.term);
                const defNorm = normalizeTurkish(item.shortDef + ' ' + (item.fullDef || ''));
                return termNorm.includes(query) || defNorm.includes(query);
            }
            return true;
        });

        // Sıralama: tam eşleşme, başlangıç eşleşmesi, terim içinde geçen, tanımda geçen; özenle yazılmış kayıtlar önce
        if (query) {
            const rank = (item) => {
                const t = normalizeTurkish(item.term);
                if (t === query) return 0;
                if (t.startsWith(query)) return 1;
                if (t.includes(query)) return 2;
                return 3;
            };
            filtered.sort((x, y) => (rank(x) - rank(y)) || ((x.src657 ? 1 : 0) - (y.src657 ? 1 : 0)));
        }
        renderLimit = 60;
        renderTerms(filtered);
    }

    function openModal(query = '') {
        load657();
        createModal();
        modalEl.style.display = 'flex';

        const searchInput = document.getElementById('dict-search-input');
        if (searchInput) {
            searchInput.value = query;
            setTimeout(() => searchInput.focus(), 80);
        }

        filterTerms();
    }

    function closeModal() {
        if (modalEl) {
            modalEl.style.display = 'none';
        }
    }

    function copyDef(term, text) {
        const snippet = `${term}: ${text} (Kaynak: 657.com.tr Hukuk Sözlüğü)`;
        navigator.clipboard.writeText(snippet).then(() => {
            if (window.showToast) {
                window.showToast(`"${term}" tanımı panoya kopyalandı.`, 'success');
            }
        });
    }

    // --------------------------------------------------------------------------
    // BAŞLATMA
    // --------------------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', () => {
        attachListeners();
        // 657.com.tr sözlük verisi sayfa boştayken yüklenir (sağ tık "Ne demek?" için hazır olsun)
        if (window.requestIdleCallback) window.requestIdleCallback(load657, { timeout: 4000 }); else setTimeout(load657, 1500);

        // Klavye kısayolu: Alt + S
        window.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                openModal();
            }
        });
    });

    // Modül API'si
    window.UkiDictionary = {
        lookup: lookup,
        get657Url: get657Url,
        openModal: openModal,
        closeModal: closeModal,
        copyDef: copyDef,
        setHoverEnabled: setHoverEnabled,
        isHoverEnabled: () => hoverEnabled,
        TERMS_DB: TERMS_DB
    };

})(window);
