// =======================================================
// ★★★ 2026年度南陵祭 公式企画データ ★★★
// =======================================================

// 企画の名簿データ (Dummy Data for 2026)
const projectData = [
    // --- 3年生 (Food) ---
    {
        id: '3-1',
        name: '激ウマ焼きそば',
        groupName: '3年1組',
        catchphrase: '伝統のソース味！',
        place: '中庭テント 01',
        floor: 1,
        tags: ['3年生', '食品'],
        description: '3年1組がお届けする、秘伝のソースを使った絶品焼きそば。売り切れ御免！',
        image: 'images/dummy/yakisoba.jpg',
        contentType: 'menu',
        menu: [
            { name: 'ソース焼きそば', price: '300円' },
            { name: '大盛り', price: '+50円' }
        ]
    },
    {
        id: '3-2',
        name: 'タピオカ喫茶',
        groupName: '3年2組',
        catchphrase: '映える！美味しい！',
        place: '南棟 2F 205',
        floor: 2,
        tags: ['3年生', '食品'],
        description: 'もちもちタピオカドリンクとフォトスポットをご用意してお待ちしています。',
        image: 'images/dummy/tapioca.jpg',
        contentType: 'menu',
        menu: [
            { name: 'タピオカミルクティー', price: '250円' },
            { name: 'タピオカ抹茶ミルク', price: '250円' }
        ]
    },
    
    // --- 1/2年生 (Attraction/Exhibition) ---
    {
        id: '2-1',
        name: 'VRお化け屋敷「冥界」',
        groupName: '2年1組',
        catchphrase: '最新技術×恐怖体験',
        place: '北棟 3F 301',
        floor: 3,
        tags: ['2年生', '体験・ゲーム'],
        description: 'VRゴーグルを使った新感覚お化け屋敷。あなたは無事に帰還できるか…？',
        image: 'images/dummy/vr-horror.jpg',
        contentType: 'gallery',
        gallery: []
    },
    {
        id: '1-4',
        name: '縁日「祭」',
        groupName: '1年4組',
        catchphrase: 'お祭り気分を味わおう！',
        place: '北棟 2F 202',
        floor: 2,
        tags: ['1年生', '体験・ゲーム'],
        description: '射的、輪投げ、スーパーボールすくい！景品もあるよ！',
        image: 'images/dummy/ennichi.jpg',
        contentType: 'gallery',
        gallery: []
    },

    // --- 部活動 ---
    {
        id: 'art-club',
        name: '美術部展「色彩」',
        groupName: '美術部',
        catchphrase: '彩り豊かな世界へ',
        place: '特別棟 2F 美術室',
        floor: 2,
        tags: ['部活動', '展示'],
        description: '部員たちが魂を込めて描いた作品の数々を展示しています。ライブペイントも開催！',
        image: 'images/dummy/art.jpg',
        contentType: 'gallery',
        gallery: []
    },
    {
        id: 'science-club',
        name: 'サイエンスショー',
        groupName: '科学部',
        catchphrase: '驚きの実験を目の前で！',
        place: '特別棟 1F 化学室',
        floor: 1,
        tags: ['部活動', '体験・ゲーム'],
        description: 'スライム作りや液体窒素実験など、子供から大人まで楽しめる実験ショー！',
        image: 'images/dummy/science.jpg',
        contentType: 'gallery',
        gallery: []
    }
];

// ステージ発表のデータ (Dummy Data for 2026)
const stageData = [
    {
        id: 'day1-keion',
        groupId: 'keion',
        groupName: '軽音楽部',
        name: 'オープニングライブ 2026',
        place: '体育館',
        time: 'Day1 09:30 - 10:30',
        tags: ['Day1', 'ステージ', '音楽'],
        description: '南陵祭の幕開けを告げる熱いライブ！みんなで盛り上がろう！'
    },
    {
        id: 'day1-dance',
        groupId: 'dance',
        groupName: 'ダンス部',
        name: 'Performance Showcase Vol.1',
        place: '体育館',
        time: 'Day1 11:00 - 12:00',
        tags: ['Day1', 'ステージ', 'パフォーマンス'],
        description: 'K-POPからHipHopまで、圧巻のダンスパフォーマンスをお届けします。'
    },
    {
        id: 'day2-brass',
        groupId: 'brass',
        groupName: '吹奏楽部',
        name: 'Autumn Concert',
        place: '体育館',
        time: 'Day2 13:00 - 14:00',
        tags: ['Day2', 'ステージ', '音楽'],
        description: '映画音楽やJ-POPなど、親しみやすい曲を中心に演奏します。'
    }
];
