/**
 * Nanryosai 2026 Official Data
 * Version: 0.2.1
 * Last Modified: 2026-09-09
 * Author: Nanryosai 2026 Project Team
 */
// =======================================================
// ★★★ 2026年度南陵祭 公式企画データ (Official Master & Form Merged) ★★★
// =======================================================

console.log("data.js loading...");

// バージョン情報 (admin_syncで同期状態を確認するために使用)
const dataVersion = "2026_OFFICIAL_RELEASE_V1";

// =======================================================
// ★ 機能公開フラグ (Feature Flags)
// ※ マップ機能本番公開フラグ: true (サイト全体で常時オン有効化)
// =======================================================
if (typeof window !== "undefined") {
  window.IS_MAP_ENABLED = true;
}
const IS_MAP_ENABLED = true;

// 企画の名簿データ
const projectData = [
  {
    "id": "101",
    "loginId": "class101",
    "groupName": "1年1組",
    "name": "銭安藤",
    "place": "生徒棟 4F 1-1",
    "floor": 4,
    "roomId": "room_202_3256_4f",
    "category": "shop",
    "votingCategory": "shop",
    "useMobileOrder": false,
    "catchphrase": "銭天堂モチーフの楽しいお店！",
    "description": "銭天堂モチーフの楽しいお店！",
    "tags": [
      "販売",
      "駄菓子"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "102",
    "loginId": "class102",
    "groupName": "1年2組",
    "name": "あさくらソーセージ工房",
    "place": "中庭 外テント",
    "floor": 1,
    "roomId": "tent_102",
    "category": "cooking",
    "votingCategory": "cooking",
    "useMobileOrder": false,
    "catchphrase": "食べますか～？フランクフルト",
    "description": "食べますか～？フランクフルト",
    "tags": [
      "調理",
      "フランクフルト",
      "外テント"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "103",
    "loginId": "class103",
    "groupName": "1年3組",
    "name": "Club13",
    "place": "生徒棟 4F 1-3",
    "floor": 4,
    "roomId": "room_204_3256_4f",
    "category": "shop",
    "votingCategory": "shop",
    "useMobileOrder": false,
    "catchphrase": "オトナなナイトを楽しみな！",
    "description": "オトナなナイトを楽しみな！ 溶ける前に恋しよう",
    "tags": [
      "販売",
      "アイス",
      "カフェ"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "104",
    "loginId": "class104",
    "groupName": "1年4組",
    "name": "TOY MANIA",
    "place": "生徒棟 4F 1-4",
    "floor": 4,
    "roomId": "room_205_3256_4f",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "おもちゃの世界へLet's Go",
    "description": "おもちゃの世界へLet's Go",
    "tags": [
      "展示",
      "アトラクション",
      "ゲーム"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "105",
    "loginId": "class105",
    "groupName": "1年5組",
    "name": "アリスのティーパーティー",
    "place": "生徒棟 4F 1-5",
    "floor": 4,
    "roomId": "room_206_3256_4f",
    "category": "shop",
    "votingCategory": "shop",
    "useMobileOrder": false,
    "catchphrase": "あなたをアリスの世界へご招待",
    "description": "あなたをアリスの世界へご招待 お客様が小さくなる!?",
    "tags": [
      "販売",
      "カフェ",
      "スイーツ"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "106",
    "loginId": "class106",
    "groupName": "1年6組",
    "name": "マダムあつひろの甘い誘惑",
    "place": "生徒棟 4F 1-6",
    "floor": 4,
    "roomId": "room_207_3256_4f",
    "category": "shop",
    "votingCategory": "shop",
    "useMobileOrder": false,
    "catchphrase": "1年6組で海外感じよ〜‼︎",
    "description": "ヨーロッパの街並みにあるようなお菓子屋さんをテーマにクッキーバームクーヘンなどの焼き菓子を販売します。お店の雰囲気を盛り上げるためにヨーロッパ風のクラシカルの内装を工夫します。",
    "instagram": "chikara_0809",
    "tags": [
      "販売",
      "菓子",
      "スイーツ"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "107",
    "loginId": "class107",
    "groupName": "1年7組",
    "name": "PINK★MONSTER",
    "place": "生徒棟 4F 1-7",
    "floor": 4,
    "roomId": "room_208_3256_4f",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "うちらの平成マジチョベリグ★",
    "description": "うちらの平成マジチョベリグ★",
    "tags": [
      "展示",
      "フォトスポット",
      "映え"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "201",
    "loginId": "class201",
    "groupName": "2年1組",
    "name": "このサーカスからは帰れない",
    "place": "生徒棟 3F 2-1",
    "floor": 3,
    "roomId": "room_202_3256_3f",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "～消えたコドモたち～",
    "description": "～消えたコドモたち～ You Can't Go Home",
    "tags": [
      "展示",
      "お化け屋敷",
      "サーカス"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "202",
    "loginId": "class202",
    "groupName": "2年2組",
    "name": "前園の闇カジノ",
    "place": "生徒棟 3F 2-2",
    "floor": 3,
    "roomId": "room_204_3256_3f",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "運命は君の手に",
    "description": "運命は君の手に",
    "tags": [
      "展示",
      "ゲーム",
      "カジノ"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "203",
    "loginId": "class203",
    "groupName": "2年3組",
    "name": "大関メイド始めました!!",
    "place": "生徒棟 3F 2-3",
    "floor": 3,
    "roomId": "room_205_3256_3f",
    "category": "shop",
    "votingCategory": "shop",
    "useMobileOrder": false,
    "catchphrase": "向井、いつでもいけます！！",
    "description": "私たちは、「大関、メイド始めました」をただの文化祭の出し物ではなく、きてくれた人の1番の思い出に残る本格的なメイド喫茶として作り上げたいと考えています。ただ可愛い制服を着て接客をするのでなく、お店に入る前から帰るまでまるで本当のメイド喫茶に来たような気持ちになってもらえるように一つ一つの演出にこだわります。",
    "instagram": "@_aoi_m__",
    "tags": [
      "販売",
      "カフェ",
      "メイド喫茶"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "204",
    "loginId": "class204",
    "groupName": "2年4組",
    "name": "今日から俺は！",
    "place": "体育館ステージ (生徒棟 3F 2-4教室)",
    "floor": 3,
    "roomId": "room_206_3256_3f",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "ツッパリ達の爆笑コメディ！",
    "description": "ツッパリ達の爆笑コメディ！",
    "tags": [
      "ステージ",
      "劇",
      "演劇",
      "コメディ"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "205",
    "loginId": "class205",
    "groupName": "2年5組",
    "name": "Route25 Diner",
    "place": "生徒棟 3F 2-5",
    "floor": 3,
    "roomId": "room_207_3256_3f",
    "category": "shop",
    "votingCategory": "shop",
    "useMobileOrder": false,
    "catchphrase": "ジュース冷えてます",
    "description": "ジュース冷えてます American Diner",
    "tags": [
      "販売",
      "カフェ",
      "ドリンク"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "206",
    "loginId": "class206",
    "groupName": "2年6組",
    "name": "走れ！",
    "place": "生徒棟 3F 2-6",
    "floor": 3,
    "roomId": "room_208_3256_3f",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "R20禁のところ今回だけR0禁",
    "description": "この企画は、普段できない賭け事ができ、そしてゲームに勝ち進め、コインを多く獲得することができれば、コインの枚数に応じて、景品（お菓子等）を獲得することができます！！（細かなルール等は、実施する時に教えます！）",
    "instagram": "dr1_n6n",
    "tags": [
      "展示",
      "ゲーム",
      "体験"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "207",
    "loginId": "class207",
    "groupName": "2年7組",
    "name": "７つ目のわら人形",
    "place": "生徒棟 3F 2-7",
    "floor": 3,
    "roomId": "room_209_3256_3f",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "鳥居をくぐった瞬間、呪いは始まる。",
    "description": "神社を舞台にした体験型お化け屋敷です。\nある日突然7つの藁人形のうち1つの封印が解かれてしまい神社に現れるようになってしまいました。もう一度封印をする為に神社の中を探索し封印出来ればクリアあなたは辿り着けるのか\n本気であなたを怖がらせに行きます。",
    "instagram": "笹森ってインスタで打ったら出てきます",
    "tags": [
      "展示",
      "お化け屋敷",
      "和風ホラー"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "301",
    "loginId": "class301",
    "groupName": "3年1組",
    "name": "アキコのひとくちカステラ",
    "place": "中庭 外テント",
    "floor": 1,
    "roomId": "tent_301",
    "category": "cooking",
    "votingCategory": "cooking",
    "useMobileOrder": false,
    "catchphrase": "アキコ監修",
    "description": "あの坂本先生監修のベビーカステラです！\nモリモリ食べれる美味しさで手が止まりませんよ〜\n食ってみな飛ぶぞ",
    "instagram": "@shu_n0220",
    "tags": [
      "調理",
      "カステラ",
      "外テント"
    ],
    "contentType": "menu",
    "menuNote": "アレルギー成分：卵、はちみつ、小麦粉、牛乳",
    "menu": [
      {
        "id": "item_301_01",
        "name": "アキコのひとくちカステラ（プレーン 10個入）",
        "price": "200円",
        "description": "坂本先生監修！ふんわりやさしい甘さの焼きたてベビーカステラです。（アレルギー：卵、はちみつ、小麦粉、牛乳）",
        "isRecommended": true,
        "isAvailable": true
      }
    ],
    "gallery": []
  },
  {
    "id": "302",
    "loginId": "class302",
    "groupName": "3年2組",
    "name": "ヤキトリ・イイダ口",
    "place": "中庭 外テント",
    "floor": 1,
    "roomId": "tent_302",
    "category": "cooking",
    "votingCategory": "cooking",
    "useMobileOrder": false,
    "catchphrase": "やっぱ、焼き鳥でしょ。",
    "description": "やっぱ、焼き鳥でしょ。",
    "tags": [
      "調理",
      "焼き鳥",
      "外テント"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "303",
    "loginId": "class303",
    "groupName": "3年3組",
    "name": "おばけやしき",
    "place": "生徒棟 4F 選択教室1",
    "floor": 4,
    "roomId": "room_4f_select1",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "悲鳴響く恐怖の館へ、ようこそ",
    "description": "悲鳴響く恐怖の館へ、ようこそ",
    "tags": [
      "展示",
      "お化け屋敷"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "304",
    "loginId": "class304",
    "groupName": "3年4組",
    "name": "千葉軒",
    "place": "昇降口前 外テント",
    "floor": 1,
    "roomId": "tent_304",
    "category": "cooking",
    "votingCategory": "cooking",
    "useMobileOrder": false,
    "catchphrase": "たべなきゃ損!!",
    "description": "たべなきゃ損!!",
    "tags": [
      "調理",
      "うどん",
      "外テント"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "305",
    "loginId": "class305",
    "groupName": "3年5組",
    "name": "ペッパーランチ（藤本屋）",
    "place": "昇降口前 外テント",
    "floor": 1,
    "roomId": "tent_305",
    "category": "cooking",
    "votingCategory": "cooking",
    "useMobileOrder": false,
    "catchphrase": "スパイシーなペッパーランチ♡",
    "description": "文化祭で味わえる本格ペッパーランチで誰でも食べやすいような味に仕上がっています",
    "instagram": "@chi_otm_0918",
    "tags": [
      "調理",
      "ペッパーランチ",
      "外テント"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "306",
    "loginId": "class306",
    "groupName": "3年6組",
    "name": "みんな赤ちゃんになれるバブバブケバブ",
    "place": "中庭 外テント",
    "floor": 1,
    "roomId": "tent_306",
    "category": "cooking",
    "votingCategory": "cooking",
    "useMobileOrder": false,
    "catchphrase": "ケバブでバブバブしよう！",
    "description": "ケバブでバブバブしよう！",
    "tags": [
      "調理",
      "ケバブ",
      "外テント"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "307",
    "loginId": "class307",
    "groupName": "3年7組",
    "name": "牛タン「塩野谷」",
    "place": "昇降口前 外テント",
    "floor": 1,
    "roomId": "tent_307",
    "category": "cooking",
    "votingCategory": "cooking",
    "useMobileOrder": false,
    "catchphrase": "おいしい塩野谷のタンです！",
    "description": "おいしい塩野谷のタンです！",
    "tags": [
      "調理",
      "牛タン",
      "外テント"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "keion",
    "loginId": "keion",
    "groupName": "軽音楽部",
    "name": "NANRYO FES",
    "place": "体育館・特別棟 3F 視聴覚室",
    "floor": 1,
    "roomId": "room_gym_main",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "熱いライブをお届けします!!!",
    "description": "軽音楽部は4月から文化祭という大舞台に向けてたくさんの練習をしてきました。\n3年生は最後の発表なので全力で楽しんで演奏したいと思います！\n皆さん是非聴きに来てください!!!",
    "instagram": "@ty_i08_",
    "tags": [
      "ステージ",
      "バンド",
      "ライブ",
      "軽音"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "game_club",
    "loginId": "game_club",
    "groupName": "ゲーム同好会",
    "name": "南陵スマブラ王決定戦2026",
    "place": "生徒棟 2F 3-2教室 / 体育館",
    "floor": 2,
    "roomId": "room_203_3256",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "南陵最強が今年も決まる！",
    "description": "南陵最強が今年も決まる！",
    "tags": [
      "展示",
      "ゲーム",
      "体験",
      "大会"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "chorus",
    "loginId": "chorus",
    "groupName": "コーラス部",
    "name": "コーラス部発表会!!",
    "place": "特別棟 4F 音楽室",
    "floor": 4,
    "roomId": "special_room_337807_4f",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "スパークルなどを歌います♪",
    "description": "『スパークル』『あなたへ』を歌います♪ ぜひ来てください!!",
    "tags": [
      "ステージ",
      "合唱",
      "音楽"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "sado",
    "loginId": "sado",
    "groupName": "茶道部",
    "name": "抹茶ファースト～まずは一服,話はそれから～",
    "place": "管理棟 2F 作法室",
    "floor": 2,
    "roomId": "special_room_188905",
    "category": "shop",
    "votingCategory": "shop",
    "useMobileOrder": false,
    "catchphrase": "「ただいま、茶の時間。」🍵",
    "description": "静かな空間で、湯気の向こうに広がるひと時の余白――。\n茶道部がお届けする、抹茶と和菓子のひととき。\n見た目の美しさだけでなく、季節の移ろいや、おもてなしの心もご堪能いただけるだろう。\nどうぞ、足をお運びいただきたい。",
    "tags": [
      "販売",
      "お茶会",
      "和",
      "体験"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "fukushi",
    "loginId": "fukushi",
    "groupName": "社会福祉部",
    "name": "手話パフォーマンス",
    "place": "体育館ステージ",
    "floor": 1,
    "roomId": "room_gym_main",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "一生懸命がんばります!!!",
    "description": "手話ソング 一生懸命がんばります!!!",
    "tags": [
      "ステージ",
      "福祉",
      "手話"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "brass",
    "loginId": "brass",
    "groupName": "吹奏楽部",
    "name": "吹奏楽部 演奏会",
    "place": "特別棟 4F 音楽室",
    "floor": 4,
    "roomId": "special_room_337807_4f",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "少人数ですががんばります！",
    "description": "吹奏楽部 演奏会 少人数ですががんばります！",
    "tags": [
      "ステージ",
      "吹奏楽",
      "演奏",
      "音楽"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "science",
    "loginId": "science",
    "groupName": "生物部",
    "name": "ミクロの生き物の世界",
    "place": "特別棟 3F 生物室",
    "floor": 3,
    "roomId": "special_room_818121_bio",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "小さな世界を見てみよう",
    "description": "小さな世界を見てみよう（苔テラリウムの体験、土壌生物について、飼ってるもの紹介、部員の生き物紹介）",
    "tags": [
      "展示",
      "生物",
      "体験",
      "理科"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "soukyoku",
    "loginId": "soukyoku",
    "groupName": "箏曲部",
    "name": "筝曲部発表会",
    "place": "体育館ステージ",
    "floor": 1,
    "roomId": "room_gym_main",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "わたしと向き合う、私の音で",
    "description": "わたしと向き合う、私の音で",
    "tags": [
      "ステージ",
      "和楽器",
      "箏",
      "音楽"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "dance",
    "loginId": "dance",
    "groupName": "モダンダンス部",
    "name": "超 cool sexy beautiful our TIME❢",
    "place": "体育館ステージ",
    "floor": 1,
    "roomId": "room_gym_main",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "うちらの魅力見せちゃうよーん",
    "description": "超 cool sexy beautiful our TIME❢",
    "tags": [
      "ステージ",
      "ダンス",
      "パフォーマンス"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "bijutsu",
    "loginId": "bijutsu",
    "groupName": "美術部",
    "name": "美術部展示",
    "place": "特別棟 3F 美術室",
    "floor": 3,
    "roomId": "special_room_337807_3f",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "魅せる、私達の美術。",
    "description": "美術室では平面作品や立体作品など数多くの作品展示を行っています！\nまた、フリースペースではお絵描きスペースも設けていますので文化祭の思い出に立ち寄って見てください！",
    "instagram": "@12_k.my",
    "tags": [
      "展示",
      "美術",
      "作品展",
      "アート"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "bungei",
    "loginId": "bungei",
    "groupName": "文芸同好会",
    "name": "ブンゲー！知恵袋",
    "place": "管理棟 2F 被服室",
    "floor": 2,
    "roomId": "special_room_188905_sewing",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "雑学学んでお菓子get！",
    "description": "ブンゲー！知恵袋",
    "tags": [
      "展示",
      "文芸",
      "クイズ",
      "同好会"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "homemaking",
    "loginId": "homemaking",
    "groupName": "ホームメイキング部",
    "name": "手作りお菓子の販売",
    "place": "1F ピロティ (外)",
    "floor": 1,
    "roomId": "spot_piloti_1f",
    "category": "cooking",
    "votingCategory": "cooking",
    "useMobileOrder": false,
    "catchphrase": "2日目限定！特製スコーン",
    "description": "2日目限定でスコーンを販売します！味はココア、チーズ、紅茶の三種類！1カップ100円、正門近くのピロティで販売するので、ぜひお買い求めください…！",
    "instagram": "@sz.0709",
    "tags": [
      "調理",
      "お菓子",
      "スイーツ",
      "ピロティ"
    ],
    "contentType": "menu",
    "menuNote": "こだわりポイント：手作りならではの優しい味わい / アレルギー表示：卵、乳、小麦",
    "menu": [
      {
        "id": "item_homemaking_01",
        "name": "手作り特製スコーン（ココア・チーズ・紅茶）",
        "price": "100円",
        "description": "2日目限定！手作りならではの優しい味わい。（アレルギー：卵、乳、小麦）",
        "isRecommended": true,
        "isAvailable": true
      }
    ],
    "gallery": []
  },
  {
    "id": "manga",
    "loginId": "manga",
    "groupName": "漫画研究部",
    "name": "描かない漫研へようこそ！",
    "place": "管理棟 2F 被服室",
    "floor": 2,
    "roomId": "special_room_188905_sewing",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "絵が描けない漫研による展示！",
    "description": "描かない漫研へようこそ！",
    "tags": [
      "展示",
      "イラスト",
      "部誌",
      "漫画"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "seitokai",
    "loginId": "seitokai",
    "groupName": "生徒会執行部",
    "name": "南陵探偵俱楽部～消えた校長と七不思議❓～",
    "place": "昇降口・放送 / 生徒棟 2F 3-1教室",
    "floor": 2,
    "roomId": "room_202_3256",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "南陵が、歪み始める―？",
    "description": "南陵探偵俱楽部～消えた校長と七不思議❓～",
    "tags": [
      "展示",
      "スタンプラリー",
      "謎解き",
      "生徒会"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "cs",
    "loginId": "cs",
    "groupName": "コンピューター科学部",
    "name": "南陵祭'26 公式Webサイト",
    "place": "Web / 生徒会本部・総合案内",
    "floor": null,
    "roomId": null,
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "南陵祭公式Webサイト",
    "description": "南陵祭公式Webサイト",
    "tags": [
      "展示",
      "Web",
      "IT",
      "システム"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "bousai",
    "loginId": "bousai",
    "groupName": "防災委員",
    "name": "高めよう防災意識",
    "place": "生徒棟 2F 廊下（配置調整中）",
    "floor": null,
    "roomId": null,
    "hiddenOnMap": true,
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "高めよう防災意識",
    "description": "高めよう防災意識",
    "tags": [
      "展示",
      "防災",
      "委員会"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "shodo",
    "loginId": "shodo",
    "groupName": "書道科",
    "name": "書道展２０２６",
    "place": "管理棟 2F 書道室",
    "floor": 2,
    "roomId": "special_room_337807",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "書道選択者による作品展",
    "description": "書道展２０２６（書道選択者による作品展）",
    "tags": [
      "展示",
      "書道",
      "作品展"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "bijutsuka",
    "loginId": "bijutsuka",
    "groupName": "美術科",
    "name": "美術科 授業制作作品展示",
    "place": "特別棟 3F 美術室",
    "floor": 3,
    "roomId": "special_room_337807_3f",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "美術科 授業制作作品展示",
    "description": "美術科 授業制作作品展示",
    "tags": [
      "展示",
      "美術科",
      "作品展示"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "unison",
    "loginId": "unison",
    "groupName": "The Unison.",
    "name": "師弟のピアノパフォーマンス⁉～セッション・ライブ！～",
    "place": "特別棟 4F 音楽室",
    "floor": 4,
    "roomId": "special_room_337807_4f",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "ピアノ演奏！最後はあの歌声!?",
    "description": "師弟のピアノパフォーマンス⁉～セッション・ライブ！～",
    "tags": [
      "ステージ",
      "ピアノ",
      "有志",
      "セッション"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "onebeat",
    "loginId": "onebeat",
    "groupName": "Onebeat",
    "name": "Onebeat～dance performance～",
    "place": "体育館ステージ",
    "floor": 1,
    "roomId": "room_gym_main",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "一瞬で心を奪う ～最高の舞台～",
    "description": "Onebeat～dance performance～",
    "tags": [
      "ステージ",
      "ダンス",
      "有志"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "saitama",
    "loginId": "saitama",
    "groupName": "さいたま・いばらき・千葉",
    "name": "千葉の下っぱ",
    "place": "体育館ステージ (後夜祭)",
    "floor": 1,
    "roomId": "room_gym_main",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "がんばります",
    "description": "千葉の下っぱ",
    "tags": [
      "ステージ",
      "ヲタ芸",
      "有志",
      "後夜祭"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "dance_3y",
    "loginId": "dance_3y",
    "groupName": "☆神seven☆",
    "name": "床と友達～向き合った３年間～",
    "place": "体育館ステージ (後夜祭)",
    "floor": 1,
    "roomId": "room_gym_main",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "床と友達～向き合った３年間～",
    "description": "床と友達～向き合った３年間～",
    "tags": [
      "ステージ",
      "ダンス",
      "有志",
      "後夜祭"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "band_3y",
    "loginId": "band_3y",
    "groupName": "ちーむにこにこ",
    "name": "3年バンド演奏",
    "place": "体育館ステージ (後夜祭)",
    "floor": 1,
    "roomId": "room_gym_main",
    "category": "stage",
    "votingCategory": "stage",
    "useMobileOrder": false,
    "catchphrase": "絶対来てね",
    "description": "みんなが盛り上がれるようなステージを目指します",
    "instagram": "@ganza_ki.h",
    "tags": [
      "ステージ",
      "バンド",
      "有志",
      "後夜祭"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "pta",
    "loginId": "pta",
    "groupName": "PTA",
    "name": "Nanryo Mart",
    "place": "生徒棟 2F 3-3教室",
    "floor": 2,
    "roomId": "room_204_3256",
    "category": "shop",
    "votingCategory": "shop",
    "useMobileOrder": false,
    "catchphrase": "Nanryo Mart",
    "description": "あなたと、コンビに、Nanryo Mart！",
    "tags": [
      "販売",
      "PTA",
      "ショップ"
    ],
    "contentType": "menu",
    "menu": [],
    "gallery": []
  },
  {
    "id": "senkyo",
    "loginId": "senkyo",
    "groupName": "選挙コーナー",
    "name": "選挙の投票体験",
    "place": "生徒棟 2F 廊下 / 特設スペース（配置調整中）",
    "floor": null,
    "roomId": null,
    "hiddenOnMap": true,
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "選挙の投票体験",
    "description": "選挙の投票体験（港南区役所協力）",
    "tags": [
      "展示",
      "体験",
      "特別企画"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  },
  {
    "id": "megumi",
    "loginId": "megumi",
    "groupName": "めぐみ",
    "name": "拉致被害者 横田めぐみさんに関する展示",
    "place": "生徒棟 2F 3-4教室",
    "floor": 2,
    "roomId": "room_205_3256",
    "category": "exhibit",
    "votingCategory": "exhibit",
    "useMobileOrder": false,
    "catchphrase": "拉致被害者横田めぐみさんに関する展示",
    "description": "拉致被害者 横田めぐみさんに関する展示",
    "tags": [
      "展示",
      "啓発",
      "特別企画"
    ],
    "contentType": "gallery",
    "menu": [],
    "gallery": []
  }
];

// ステージ発表のスケジュールデータ (SSOT)
const stageData = [
  // ================= DAY 1 (9/11 金・校内公開) =================
  // --- 体育館 ---
  {
    id: "teacher_band_d1",
    day: 1,
    time: "10:45 - 10:55",
    groupName: "教員バンド",
    name: "教員バンド生演奏",
    place: "体育館",
    description: "先生方によるスペシャルサプライズバンド演奏！",
    tags: ["Day1", "音楽", "バンド"],
  },
  {
    id: "keion_gym_d1",
    day: 1,
    time: "11:00 - 12:10",
    groupName: "軽音楽部",
    name: "NANRYO FES (体育館)",
    place: "体育館",
    description: "軽音楽部による迫力の体育館ライブステージ！",
    tags: ["Day1", "音楽", "バンド", "ライブ"],
  },
  {
    id: "drama_204_d1",
    day: 1,
    time: "12:25 - 13:25",
    groupName: "2年4組",
    name: "今日から俺は！",
    place: "体育館",
    description: "ツッパリ達の爆笑コメディ！熱気あふれる演劇をお見逃しなく！",
    tags: ["Day1", "演劇", "ステージ"],
  },
  {
    id: "fukushi_d1",
    day: 1,
    time: "13:30 - 13:45",
    groupName: "社会福祉部",
    name: "手話パフォーマンス",
    place: "体育館",
    description: "手話ソングなどのパフォーマンスを披露します。",
    tags: ["Day1", "ステージ", "手話"],
  },
  {
    id: "dance_d1",
    day: 1,
    time: "13:50 - 15:00",
    groupName: "モダンダンス部",
    name: "超 cool sexy beautiful our TIME❢",
    place: "体育館",
    description: "モダンダンス部による圧巻のダンスステージ！",
    tags: ["Day1", "ダンス"],
  },

  // --- 視聴覚室 ---
  {
    id: "keion_av_d1",
    day: 1,
    time: "10:45 - 15:00",
    groupName: "軽音楽部",
    name: "NANRYO FES (視聴覚)",
    place: "視聴覚室",
    description: "特別棟3階 視聴覚室にて部員バンドが熱いライブをお届け！",
    tags: ["Day1", "音楽", "バンド"],
  },

  // --- 音楽室 ---
  {
    id: "piano_unison_d1",
    day: 1,
    time: "10:45 - 11:45",
    groupName: "The Unison. (1-6ピアノ有志)",
    name: "師弟のピアノパフォーマンス⁉～セッション・ライブ！～",
    place: "音楽室",
    description: "1年6組有志によるピアノセッション演奏。",
    tags: ["Day1", "音楽", "ピアノ"],
  },
  {
    id: "brass_d1",
    day: 1,
    time: "13:30 - 14:30",
    groupName: "吹奏楽部",
    name: "吹奏楽部 演奏会",
    place: "音楽室",
    description: "息の合ったアンサンブル演奏をお届けします。",
    tags: ["Day1", "音楽", "吹奏楽"],
  },

  // ================= DAY 2 (9/12 土・一般公開) =================
  // --- 体育館 ---
  {
    id: "soukyoku_d2",
    day: 2,
    time: "10:15 - 11:00",
    groupName: "箏曲部",
    name: "筝曲部発表会",
    place: "体育館",
    description: "伝統の和の音色を響かせるお箏の演奏会。",
    tags: ["Day2", "音楽", "和楽器"],
  },
  {
    id: "drama_204_d2",
    day: 2,
    time: "11:05 - 12:05",
    groupName: "2年4組",
    name: "今日から俺は！",
    place: "体育館",
    description: "ツッパリ達の爆笑コメディ！一般公開DAY2ステージ！",
    tags: ["Day2", "演劇", "ステージ"],
  },
  {
    id: "dance_onebeat_d2",
    day: 2,
    time: "12:10 - 12:25",
    groupName: "Onebeat (2-1ダンス有志)",
    name: "Onebeat～dance performance～",
    place: "体育館",
    description: "2年1組有志によるエネルギッシュなダンスステージ！",
    tags: ["Day2", "ダンス"],
  },
  {
    id: "fukushi_d2",
    day: 2,
    time: "12:30 - 12:45",
    groupName: "社会福祉部",
    name: "手話パフォーマンス",
    place: "体育館",
    description: "心温まる手話ソングパフォーマンスを披露します。",
    tags: ["Day2", "ステージ", "手話"],
  },
  {
    id: "dance_d2",
    day: 2,
    time: "12:50 - 13:50",
    groupName: "モダンダンス部",
    name: "超 cool sexy beautiful our TIME❢",
    place: "体育館",
    description: "DAY2 モダンダンス部による最高のダンスパフォーマンス！",
    tags: ["Day2", "ダンス"],
  },
  {
    id: "keion_gym_d2",
    day: 2,
    time: "14:00 - 15:00",
    groupName: "軽音楽部",
    name: "NANRYO FES (体育館)",
    place: "体育館",
    description: "南陵祭一般公開のフィナーレを飾る体育館ライブ！",
    tags: ["Day2", "音楽", "バンド", "ライブ"],
  },

  // --- 視聴覚室 ---
  {
    id: "keion_av_d2",
    day: 2,
    time: "10:00 - 15:00",
    groupName: "軽音楽部",
    name: "NANRYO FES (視聴覚)",
    place: "視聴覚室",
    description: "特別棟3階 視聴覚室にて一日中熱いライブをお届け！",
    tags: ["Day2", "音楽", "バンド"],
  },

  // --- 音楽室 ---
  {
    id: "piano_unison_d2",
    day: 2,
    time: "10:45 - 11:45",
    groupName: "The Unison. (1-6ピアノ有志)",
    name: "師弟のピアノパフォーマンス⁉～セッション・ライブ！～",
    place: "音楽室",
    description: "1年6組有志によるピアノセッションDAY2。",
    tags: ["Day2", "音楽", "ピアノ"],
  },
  {
    id: "chorus_d2",
    day: 2,
    time: "12:00 - 13:00",
    groupName: "コーラス部",
    name: "コーラス部発表会!!",
    place: "音楽室",
    description: "『スパークル』『あなたへ』などの美しい合唱をお届けします。",
    tags: ["Day2", "音楽", "合唱"],
  },
  {
    id: "brass_d2",
    day: 2,
    time: "13:30 - 14:30",
    groupName: "吹奏楽部",
    name: "吹奏楽部 演奏会",
    place: "音楽室",
    description: "迫力のサウンド！吹奏楽部アンサンブルコンサート。",
    tags: ["Day2", "音楽", "吹奏楽"],
  },

  // ================= 後夜祭 (DAY 2 夕方・体育館) ※在校生限定 =================
  {
    id: "game_club_after",
    day: 2,
    time: "15:45 - 16:00",
    groupName: "ゲーム同好会",
    name: "南陵スマブラ王決定戦2026 (決勝)",
    place: "体育館",
    description: "後夜祭オープニングを飾るスマブラ頂上決戦！",
    tags: ["Day2", "後夜祭", "ゲーム"],
  },
  {
    id: "stage_otagei_3y",
    day: 2,
    time: "16:00 - 16:10",
    groupName: "さいたま・いばらき・千葉 (3-4ヲタ芸有志)",
    name: "千葉の下っぱ",
    place: "体育館",
    description: "光とキレの圧巻ヲタ芸パフォーマンス！",
    tags: ["Day2", "後夜祭", "ステージ", "ヲタ芸"],
  },
  {
    id: "stage_dance_2y",
    day: 2,
    time: "16:10 - 16:20",
    groupName: "2年有志ダンス",
    name: "2年有志ダンス",
    place: "体育館",
    description: "2年生有志による後夜祭ダンスステージ！",
    tags: ["Day2", "後夜祭", "ダンス"],
  },
  {
    id: "stage_dance_3y",
    day: 2,
    time: "16:20 - 16:30",
    groupName: "☆神seven☆ (ダンス有志)",
    name: "床と友達～向き合った３年間～",
    place: "体育館",
    description: "3年生有志による後夜祭ダンスステージ！",
    tags: ["Day2", "後夜祭", "ダンス"],
  },
  {
    id: "band_3y_after",
    day: 2,
    time: "16:30 - 16:45",
    groupName: "ちーむにこにこ (3年有志バンド)",
    name: "3年バンド演奏",
    place: "体育館",
    description: "盛り上がるステージ！3年有志バンドによる熱い生演奏！",
    tags: ["Day2", "後夜祭", "音楽", "バンド"],
  },
  {
    id: "keion_after",
    day: 2,
    time: "16:45 - 17:00",
    groupName: "軽音楽部",
    name: "NANRYOFES (後夜祭フィナーレ)",
    place: "体育館",
    description: "南陵祭2026のフィナーレを飾るラストライブ！",
    tags: ["Day2", "後夜祭", "音楽", "バンド"],
  },
];

console.log("data.js loaded: projectData count =", projectData.length);
console.log("data.js loaded: stageData count =", stageData.length);

// グローバルアクセス用に window オブジェクトに紐付け
if (typeof window !== "undefined") {
  window.projectData = projectData;
  window.stageData = stageData;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { projectData, stageData };
}