export const exportHeader =
  "list_name,list_description,title,year,type,tmdb_id,imdb_id,rank,created_at";

export const exportCsv = `${exportHeader}\r\n"Weekend, favorites","Line one\nLine two","A \"\"great\"\" movie",2020,movie,10,tt100,2,today\r\n"Weekend, favorites",,First show,2021,show,20,tt200,1,today\r\nOther,,Only TMDB,2022,movie,30,,1,today\r\nOther,,Episode,2022,episode,40,tt400,2,today\r\n`;

export const exportItems = [
  {
    title: "First movie",
    year: "2020",
    type: "movie",
    tmdb_id: "10",
    imdb_id: "tt100",
    rank: "1",
  },
  {
    title: "Second show",
    year: "2021",
    type: "show",
    tmdb_id: "20",
    imdb_id: "tt200",
    rank: "2",
  },
];

export const imdbHeader = "Position,Const,Title,Title Type,Year,Description,Your Rating";

export const imdbCsv = `${imdbHeader}\r\n2,tt100,"A ""great"" movie",Movie,2026,"private\nnotes",9\r\n1,tt200,"Series, one",TV Series,2020,,8\r\n3,tt300,Special,TV Special,2024,,\r\n`;
