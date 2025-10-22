import React, { useState, useCallback, useEffect } from 'react';
import { Channel, EpgData, Programme } from './types';
import { parseM3U } from './services/m3uParser';
import { fetchAndParseEPG } from './services/epgService';
import { loadSettings, saveSettings } from './services/storageService';
import UrlInput from './components/UrlInput';
import ChannelList from './components/ChannelList';
import Player from './components/Player';
import ProgramInfo from './components/ProgramInfo';
import SettingsModal from './components/SettingsModal';
import SettingsIcon from './components/icons/SettingsIcon';
import KiwiSdrView from './components/KiwiSdrView';
import TvIcon from './components/icons/TvIcon';
import RadioIcon from './components/icons/RadioIcon';
import IntroAnimation from './components/IntroAnimation';

// The comprehensive M3U playlist provided by the user.
const PRELOADED_SAMPLE_M3U = `#EXTM3U url-tvg="https://epg.freejptv.com/jp.xml,https://animenosekai.github.io/japanterebi-xmltv/guide.xml" tvg-shift=0 m3uautoload=1

#EXTINF:-1 group-title="Information" tvg-logo="https://i.imgur.com/2OINFaA.png",We need donations to maintain the server! | サーバー維持のため寄付募集中！
http://mt01.utako.moe:8001/radio
#EXTINF:-1 group-title="Information" tvg-logo="https://i.imgur.com/vFOBppE.png",Donate/寄付: https://paypal.me/Tieptran1970
http://mt01.utako.moe:8001/radio
#EXTINF:-1 group-title="Information" tvg-logo="https://cdn-icons-png.flaticon.com/512/0/49.png", Please refrain from re-sharing those URLs! Read github for details.
http://mt01.utako.moe:8001/radio
#EXTINF:-1 group-title="Information" tvg-logo="https://cdn-icons-png.flaticon.com/512/0/49.png", 「utako.moe」リンクURLの他所への転載お断り!!詳細はgithubのREADME
http://mt01.utako.moe:8001/radio



#EXTINF:-1 group-title="Tokyo" tvg-id="nhk_g_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/6/6f/NHK%E7%B7%8F%E5%90%88%E3%83%AD%E3%82%B42020-.png",NHK G
https://mt01.utako.moe/NHK_G/index.m3u8
#EXTINF:-1 group-title="Tokyo" tvg-id="nhk_e_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/a/aa/NHKE%E3%83%86%E3%83%AC%E3%83%AD%E3%82%B42020-.png",NHK E
https://mt01.utako.moe/NHK_E/index.m3u8
#EXTINF:-1 group-title="Tokyo" tvg-id="ntv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Nippon_TV_logo_2014.svg/2560px-Nippon_TV_logo_2014.svg.png",NTV
https://mt01.utako.moe/Nippon_TV/index.m3u8
#EXTINF:-1 group-title="Tokyo" tvg-id="tbs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Tokyo_Broadcasting_System_logo_2020.svg/2560px-Tokyo_Broadcasting_System_logo_2020.svg.png",TBS
https://mt01.utako.moe/TBS/index.m3u8
#EXTINF:-1 group-title="Tokyo" tvg-id="fuji_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/fr/thumb/6/65/Fuji_TV_Logo.svg/1049px-Fuji_TV_Logo.svg.png",Fuji TV
https://mt01.utako.moe/Fuji_TV/index.m3u8
#EXTINF:-1 group-title="Tokyo" tvg-id="tv_asahi" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/TV_Asahi_Logo.svg/2560px-TV_Asahi_Logo.svg.png",TV Asahi
https://mt01.utako.moe/TV_Asahi/index.m3u8
#EXTINF:-1 group-title="Tokyo" tvg-id="tv_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/TV_Tokyo_logo_2023.svg/2560px-TV_Tokyo_logo_2023.svg.png",TV Tokyo
https://mt01.utako.moe/TV_Tokyo/index.m3u8
#EXTINF:-1 group-title="Tokyo" tvg-id="tokyo_mx_1" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Tokyo_metropolitan_television_logo_%28rainbow%29.svg/2560px-Tokyo_metropolitan_television_logo_%28rainbow%29.svg.png",TOKYO MX1
https://mt01.utako.moe/Tokyo_MX1/index.m3u8
#EXTINF:-1 group-title="Tokyo" tvg-id="tokyo_mx2" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Tokyo_metropolitan_television_logo_%28rainbow%29.svg/2560px-Tokyo_metropolitan_television_logo_%28rainbow%29.svg.png",TOKYO MX2
https://mt01.utako.moe/Tokyo_MX2/index.m3u8

#EXTINF:-1 group-title="Tokyo" tvg-id="nhk_g_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/6/6f/NHK%E7%B7%8F%E5%90%88%E3%83%AD%E3%82%B42020-.png",NHK G HD (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=hdgd01
#EXTINF:-1 group-title="Tokyo" tvg-id="nhk_e_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/a/aa/NHKE%E3%83%86%E3%83%AC%E3%83%AD%E3%82%B42020-.png",NHK E HD (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=hdgd02
#EXTINF:-1 group-title="Tokyo" tvg-id="ntv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Nippon_TV_logo_2014.svg/2560px-Nippon_TV_logo_2014.svg.png",NTV HD (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=hdgd03
#EXTINF:-1 group-title="Tokyo" tvg-id="tbs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Tokyo_Broadcasting_System_logo_2020.svg/2560px-Tokyo_Broadcasting_System_logo_2020.svg.png",TBS HD (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=hdgd04
#EXTINF:-1 group-title="Tokyo" tvg-id="fuji_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/fr/thumb/6/65/Fuji_TV_Logo.svg/1049px-Fuji_TV_Logo.svg.png",Fuji TV HD (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=hdgd05
#EXTINF:-1 group-title="Tokyo" tvg-id="tv_asahi" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/TV_Asahi_Logo.svg/2560px-TV_Asahi_Logo.svg.png",TV Asahi HD (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=hdgd06
#EXTINF:-1 group-title="Tokyo" tvg-id="tv_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/TV_Tokyo_logo_2023.svg/2560px-TV_Tokyo_logo_2023.svg.png",TV Tokyo HD (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=hdgd07
#EXTINF:-1 group-title="Tokyo" tvg-id="tokyo_mx_1" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Tokyo_metropolitan_television_logo_%28rainbow%29.svg/2560px-Tokyo_metropolitan_television_logo_%28rainbow%29.svg.png",TOKYO MX1 HD (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=hdgd08
#EXTINF:-1 group-title="Tokyo" tvg-id="nhk_g_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/6/6f/NHK%E7%B7%8F%E5%90%88%E3%83%AD%E3%82%B42020-.png",NHK G (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gd01
#EXTINF:-1 group-title="Tokyo" tvg-id="nhk_e_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/a/aa/NHKE%E3%83%86%E3%83%AC%E3%83%AD%E3%82%B42020-.png",NHK E (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gd02
#EXTINF:-1 group-title="Tokyo" tvg-id="ntv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Nippon_TV_logo_2014.svg/2560px-Nippon_TV_logo_2014.svg.png",NTV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gd03
#EXTINF:-1 group-title="Tokyo" tvg-id="tbs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Tokyo_Broadcasting_System_logo_2020.svg/2560px-Tokyo_Broadcasting_System_logo_2020.svg.png",TBS (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gd04
#EXTINF:-1 group-title="Tokyo" tvg-id="fuji_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/fr/thumb/6/65/Fuji_TV_Logo.svg/1049px-Fuji_TV_Logo.svg.png",Fuji TV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gd05
#EXTINF:-1 group-title="Tokyo" tvg-id="tv_asahi" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/TV_Asahi_Logo.svg/2560px-TV_Asahi_Logo.svg.png",TV Asahi (NSFW) (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gd06
#EXTINF:-1 group-title="Tokyo" tvg-id="tv_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/TV_Tokyo_logo_2023.svg/2560px-TV_Tokyo_logo_2023.svg.png",TV Tokyo (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gd07
#EXTINF:-1 group-title="Tokyo" tvg-id="tokyo_mx_1" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Tokyo_metropolitan_television_logo_%28rainbow%29.svg/2560px-Tokyo_metropolitan_television_logo_%28rainbow%29.svg.png",TOKYO MX1 (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gd08

#EXTINF:-1 group-title="Kansai" tvg-id="mbs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Mainichi_Broadcasting_System_logo.svg/1920px-Mainichi_Broadcasting_System_logo.svg.png",MBS
https://mt01.utako.moe/mbs/index.m3u8
#EXTINF:-1 group-title="Kansai" tvg-id="abc" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Asahi_Broadcasting_Corporation_Logo.svg/261px-Asahi_Broadcasting_Corporation_Logo.svg.png",ABC
https://mt01.utako.moe/abc/index.m3u8
#EXTINF:-1 group-title="Kansai" tvg-id="tv_osaka" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Tv_osaka_logo.svg/178px-Tv_osaka_logo.svg.png",TV Osaka
https://mt01.utako.moe/tvo/index.m3u8
#EXTINF:-1 group-title="Kansai" tvg-id="kansai_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Ktv_logo.svg/200px-Ktv_logo.svg.png",Kansai TV
https://mt01.utako.moe/kansaitv/index.m3u8
#EXTINF:-1 group-title="Kansai" tvg-id="yomiuri_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Yomiuri_Telecasting_Corporation_Logo.svg/150px-Yomiuri_Telecasting_Corporation_Logo.svg.png",ytv
https://mt01.utako.moe/ytv/index.m3u8
#EXTINF:-1 group-title="Kansai" tvg-id="kbs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Kbs_logo.svg/250px-Kbs_logo.svg.png",KBS
https://mt01.utako.moe/kbs/index.m3u8
#EXTINF:-1 group-title="Kansai" tvg-id="sun_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/SUN-TV_wordmark_2019.png/180px-SUN-TV_wordmark_2019.png",SUN
https://mt01.utako.moe/suntv/index.m3u8

#EXTINF:-1 group-title="Kansai" tvg-id="nhk_g_osaka" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/6/6f/NHK%E7%B7%8F%E5%90%88%E3%83%AD%E3%82%B42020-.png",NHK G Osaka (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gx06
#EXTINF:-1 group-title="Kansai" tvg-id="mbs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Mainichi_Broadcasting_System_logo.svg/1920px-Mainichi_Broadcasting_System_logo.svg.png",MBS (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gx01
#EXTINF:-1 group-title="Kansai" tvg-id="abc" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Asahi_Broadcasting_Corporation_Logo.svg/261px-Asahi_Broadcasting_Corporation_Logo.svg.png",ABC (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gx02
#EXTINF:-1 group-title="Kansai" tvg-id="kansai_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Ktv_logo.svg/200px-Ktv_logo.svg.png",Kansai TV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gx03
#EXTINF:-1 group-title="Kansai" tvg-id="yomiuri_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Yomiuri_Telecasting_Corporation_Logo.svg/150px-Yomiuri_Telecasting_Corporation_Logo.svg.png",ytv (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gx04
#EXTINF:-1 group-title="Kansai" tvg-id="tv_osaka" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Tv_osaka_logo.svg/178px-Tv_osaka_logo.svg.png",TV Osaka (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gx05
#EXTINF:-1 group-title="Kansai" tvg-id="sun_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/SUN-TV_wordmark_2019.png/180px-SUN-TV_wordmark_2019.png",SUN (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=gx07

#EXTINF:-1 group-title="BS" tvg-id="nhk_bs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/6/6c/NHK_BS.png",NHK BS
https://mt01.utako.moe/NHK_BS/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="bs_ntv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/BS4_logo.svg/2560px-BS4_logo.svg.png",BS NTV
https://mt01.utako.moe/bsntv/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="bs_asahi" tvg-logo="https://www.bs-asahi.co.jp/wp-content/uploads/2021/06/oglogo.jpg",BS Asahi
https://mt01.utako.moe/bsasahi/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="bs_tbs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/BS-TBS_2020.svg/1920px-BS-TBS_2020.svg.png",BS TBS
https://mt01.utako.moe/bstbs/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="bs_tv_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/BS_TV_Tokyo_%28Japanese%29_2023.svg/1920px-BS_TV_Tokyo_%28Japanese%29_2023.svg.png",BS TV Tokyo
https://mt01.utako.moe/bstvtokyo/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="bs_fuji" tvg-logo="https://upload.wikimedia.org/wikipedia/en/thumb/7/74/BSFuji2008Symbol.svg/1280px-BSFuji2008Symbol.svg.png",BS Fuji
https://mt01.utako.moe/bsfuji/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="bs11" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/BS11_logo.svg/2560px-BS11_logo.svg.pngion_logo_%28rainbow%29.svg.png",BS11
https://mt01.utako.moe/BS11/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="nhk_bsp_4k" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/NHK_BSP4K_2023_logo.svg/1920px-NHK_BSP4K_2023_logo.svg.png",NHK BS4K
https://mt01.utako.moe/bsp4k/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="wowow_prime" tvg-logo="https://www.lyngsat.com/logo/tv/ww/wowow_prime.png",WOWOW Prime
https://mt01.utako.moe/wprime/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="wowow_cinema" tvg-logo="https://www.lyngsat.com/logo/tv/ww/wowow_cinema.png",WOWOW Cinema
https://mt01.utako.moe/wcinema/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="wowow_live" tvg-logo="https://www.lyngsat.com/logo/tv/ww/wowow_live.png",WOWOW Live
https://mt01.utako.moe/wlive/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="bs10_star_channel" tvg-logo="https://www.lyngsat.com/logo/tv/bb/bs-10-star-channel-jp.png",BS 10 Star Channel
https://mt01.utako.moe/bs10_star/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="js1" tvg-logo="https://www.starcat.co.jp/ch/upload/channel/69/jsports1_logo.jpg",JSport 1
https://mt01.utako.moe/js1/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="js2" tvg-logo="https://www.starcat.co.jp/ch/upload/channel/70/jsports2_logo.jpg",JSport 2
https://mt01.utako.moe/js2/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="js3" tvg-logo="https://www.starcat.co.jp/ch/upload/channel/71/jsports3_logo.jpg",JSport 3
https://mt01.utako.moe/js3/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="js4" tvg-logo="https://www.starcat.co.jp/ch/upload/channel/74/jsports4_logo.jpg",JSport 4
https://mt01.utako.moe/js4/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="green_channel" tvg-logo="https://www.lyngsat.com/logo/tv/gg/green-channel-jp.svg",Green Channel
https://mt01.utako.moe/green/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="animax" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Animax.svg/1920px-Animax.svg.png",Animax
https://ca01.utako.moe/Animax/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="nihon_eiga" tvg-logo="https://www.lyngsat.com/logo/tv/nn/nihon_eiga_senmon.png",Nihon Eiga Senmon
https://ca01.utako.moe/nihoneiga/index.m3u8
#EXTINF:-1 group-title="BS" tvg-id="sky_a" tvg-logo="https://www.lyngsat.com/logo/tv/ss/sky-a-jp.svg",Sky A
https://ca01.utako.moe/skya/index.m3u8

#EXTINF:-1 group-title="BS" tvg-id="nhk_bs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/6/6c/NHK_BS.png",NHK BS (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs11
#EXTINF:-1 group-title="BS" tvg-id="bs_ntv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/BS4_logo.svg/2560px-BS4_logo.svg.png",BS NTV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs02
#EXTINF:-1 group-title="BS" tvg-id="bs_asahi" tvg-logo="https://www.bs-asahi.co.jp/wp-content/uploads/2021/06/oglogo.jpg",BS Asahi (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs03
#EXTINF:-1 group-title="BS" tvg-id="bs_tbs" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/BS-TBS_2020.svg/1920px-BS-TBS_2020.svg.png",BS TBS (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs04
#EXTINF:-1 group-title="BS" tvg-id="bs_tv_tokyo" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/BS_TV_Tokyo_%28Japanese%29_2023.svg/1920px-BS_TV_Tokyo_%28Japanese%29_2023.svg.png",BS TV Tokyo (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs05
#EXTINF:-1 group-title="BS" tvg-id="bs_fuji" tvg-logo="https://upload.wikimedia.org/wikipedia/en/thumb/7/74/BSFuji2008Symbol.svg/1280px-BSFuji2008Symbol.svg.png",BS Fuji (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs06
#EXTINF:-1 group-title="BS" tvg-id="nhk_bsp_4k" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/NHK_BSP4K_2023_logo.svg/1920px-NHK_BSP4K_2023_logo.svg.png",NHK BS4K (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs01
#EXTINF:-1 group-title="BS" tvg-id="wowow_prime" tvg-logo="https://www.lyngsat.com/logo/tv/ww/wowow_prime.png",WOWOW Prime (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs12
#EXTINF:-1 group-title="BS" tvg-id="wowow_cinema" tvg-logo="https://www.lyngsat.com/logo/tv/ww/wowow_cinema.png",WOWOW Cinema (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs07
#EXTINF:-1 group-title="BS" tvg-id="wowow_live" tvg-logo="https://www.lyngsat.com/logo/tv/ww/wowow_live.png",WOWOW Live (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs20
#EXTINF:-1 group-title="BS" tvg-id="bs10_star_channel" tvg-logo="https://www.lyngsat.com/logo/tv/bb/bs-10-star-channel-jp.png",BS 10 Star Channel (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs08
#EXTINF:-1 group-title="BS" tvg-id="js1" tvg-logo="https://www.starcat.co.jp/ch/upload/channel/69/jsports1_logo.jpg",JSport 1 (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs18
#EXTINF:-1 group-title="BS" tvg-id="js2" tvg-logo="https://www.starcat.co.jp/ch/upload/channel/70/jsports2_logo.jpg",JSport 2 (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs19
#EXTINF:-1 group-title="BS" tvg-id="js3" tvg-logo="https://www.starcat.co.jp/ch/upload/channel/71/jsports3_logo.jpg",JSport 3 (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs21
#EXTINF:-1 group-title="BS" tvg-id="js4" tvg-logo="https://www.starcat.co.jp/ch/upload/channel/74/jsports4_logo.jpg",JSport 4 (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs22
#EXTINF:-1 group-title="BS" tvg-id="green_channel" tvg-logo="https://www.lyngsat.com/logo/tv/gg/green-channel-jp.svg",Green Channel (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs14
#EXTINF:-1 group-title="BS" tvg-id="animax" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Animax.svg/1920px-Animax.svg.png",Animax (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs15
#EXTINF:-1 group-title="BS" tvg-id="nihon_eiga" tvg-logo="https://www.lyngsat.com/logo/tv/nn/nihon_eiga_senmon.png",Nihon Eiga Senmon (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs23
#EXTINF:-1 group-title="BS" tvg-id="sky_a" tvg-logo="https://www.lyngsat.com/logo/tv/ss/sky-a-jp.svg",Sky A (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs01
#EXTINF:-1 group-title="BS" tvg-id="fishing_vision" tvg-logo="https://www.lyngsat.com/logo/tv/tt/tsuri_vision.png", Fishing Vision (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs25
#EXTINF:-1 group-title="BS" tvg-id="disney_channel" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/2019_Disney_Channel_logo.svg/250px-2019_Disney_Channel_logo.svg.png", Disney Channel (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs24 
#EXTINF:-1 group-title="BS" tvg-id="jcom_bs" tvg-logo="https://static.wikia.nocookie.net/logopedia/images/9/90/JCOM_BS_2.png/revision/latest/scale-to-width-down/1000?cb=20250825145119", JCOM BS (Primehome)
https://proxy.utako.moe/ph.php?&isp=2&id=bs31

#EXTINF:-1 group-title="CS" tvg-id="gaora" tvg-logo="https://www.lyngsat.com/logo/tv/gg/gaora-sports-jp.svg",Gaora Sports
https://mt01.utako.moe/gaora/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="at_x" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/AT-X_logo.svg/2560px-AT-X_logo.svg.png",AT-X
https://mt01.utako.moe/AT-X/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="space_shower_tv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/0/05/SPACE_SHOWER_TV.jpg",Space Shower TV
https://ca01.utako.moe/spaceshower/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="mtv" tvg-logo="https://www.lyngsat.com/logo/tv/mm/mtv-us.svg",MTV
https://ca01.utako.moe/mtv/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="mnet" tvg-logo="https://www.lyngsat.com/logo/tv/mm/m_net_jp.png",Mnet
https://ca01.utako.moe/mnet/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="kayo_pops" tvg-logo="https://www.lyngsat.com/logo/tv/kk/kayo-pops-jp.svg",Kayo Pops
https://ca01.utako.moe/kayopops/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="disney_channel" tvg-logo="https://www.lyngsat.com/logo/tv/dd/disney-channel-us.svg",Disney Channel
https://ca01.utako.moe/disneychan/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="cartoon_network" tvg-logo="https://www.lyngsat.com/logo/tv/cc/cartoon-network-us.svg",Cartoon Network Japan
https://ca01.utako.moe/cartoon_network/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="ntv_g_tasu" tvg-logo="https://www.lyngsat-logo.com/logo/tv/nn/ntv-g-plus-jp.png",Nittele G+
https://ca01.utako.moe/ntvgplus/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="family_gekijo" tvg-logo="https://www.lyngsat.com/logo/tv/ff/family_gekijyo_jp.png",Family Gekijyo
https://ca01.utako.moe/familygeki/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="mondo_tv" tvg-logo="https://www.lyngsat.com/logo/tv/mm/mondo_tv_jp.png",Mondo TV
https://ca01.utako.moe/mondo/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="tbs_channel_1" tvg-logo="https://www.lyngsat.com/logo/tv/tt/tbs-channel-1-jp.png",TBS Channel 1
https://ca01.utako.moe/tbsch1/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="tbs_channel_2" tvg-logo="https://www.lyngsat.com/logo/tv/tt/tbs-channel-2-jp.png",TBS Channel 2
https://ca01.utako.moe/tbsch2/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="tv_asahi_channel_1" tvg-logo="https://www.lyngsat.com/logo/tv/tt/tv-asahi-channel-1-jp.png",TV Asahi Channel 1
https://ca01.utako.moe/ex_ch1/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="tv_asahi_channel_2" tvg-logo="https://www.lyngsat.com/logo/tv/tt/tv-asahi-channel-2-jp.png",TV Asahi Channel 2
https://ca01.utako.moe/ex_ch2/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="fuji_tv_one" tvg-logo="https://www.lyngsat.com/logo/tv/ff/fuji_tv_one.png",Fuji TV ONE
https://ca01.utako.moe/fuji_one/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="fuji_tv_two" tvg-logo="https://www.lyngsat.com/logo/tv/ff/fuji_tv_two.png",Fuji TV TWO
https://ca01.utako.moe/fuji_two/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="fuji_tv_next" tvg-logo="https://www.lyngsat.com/logo/tv/ff/fuji_tv_next.png",Fuji TV NEXT
https://ca01.utako.moe/fuji_next/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="neco" tvg-logo="https://www.lyngsat.com/logo/tv/cc/channel-neco-jp.png",Neco Channel
https://ca01.utako.moe/neco/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="dlife" tvg-logo="https://www.lyngsat.com/logo/tv/dd/dlife-jp.png",Dlife
https://ca01.utako.moe/dlife/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="toei_channel" tvg-logo="https://www.lyngsat.com/logo/tv/tt/toei_channel.png",Toei Channel
https://ca01.utako.moe/toei/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="fighting_tv" tvg-logo="https://www.lyngsat.com/logo/tv/ff/fighting-tv-samurai-jp.png",Fighting TV Samurai
https://ca01.utako.moe/fighting_tv/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="entermei_tele" tvg-logo="https://www.lyngsat.com/logo/tv/ee/entermei-telepng-jp.png",Entermei Tele
https://ca01.utako.moe/entermei_tele/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="sports_live_plus" tvg-logo="https://www.lyngsat.com/logo/tv/ss/sports-live-plus-jp.png",Sport Live Plus
https://ca01.utako.moe/sport_live_plus/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="home_drama" tvg-logo="https://www.lyngsat.com/logo/tv/hh/home-drama-channelpng-jp.png",Home Drama Channel
https://ca01.utako.moe/homedrama/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="channel_ginga" tvg-logo="https://www.lyngsat.com/logo/tv/cc/channel_ginga.png",Channel Ginga
https://ca01.utako.moe/gingach/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="tabi_channel" tvg-logo="https://www.lyngsat.com/logo/tv/tt/tabi_channel.png",Tabi Channel
https://ca01.utako.moe/tabi/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="pigoo" tvg-logo="https://www.lyngsat.com/logo/tv/pp/pigoo-jp.png",Pigoo (NSFW)
https://ca01.utako.moe/pigoo/index.m3u8
#EXTINF:-1 group-title="CS" tvg-id="v_paradise" tvg-logo="https://www.lyngsat.com/logo/tv/vv/v_paradise_jp.png",V Paradise (NSFW)
https://ca01.utako.moe/v_paradise/index.m3u8

#EXTINF:-1 group-title="CS" tvg-id="jidaigeki" tvg-logo="https://www.lyngsat.com/logo/tv/jj/jidaigeki.png", Jidaigeki Senmon (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs04
#EXTINF:-1 group-title="CS" tvg-id="toei_channel" tvg-logo="https://www.lyngsat-logo.com/logo/tv/tt/toei_channel.png", Toei Channel (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs27
#EXTINF:-1 group-title="CS" tvg-id="eigeki" tvg-logo="https://www.lyngsat-logo.com/logo/tv/ee/eisei_gekijo.png", Eisei Gekijo (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs22
#EXTINF:-1 group-title="CS" tvg-id="family_geki" tvg-logo="https://www.lyngsat-logo.com/logo/tv/ff/family_gekijyo_jp.png", Family Gekijyo (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs20
#EXTINF:-1 group-title="CS" tvg-id="movie_plus" tvg-logo="https://www.lyngsat-logo.com/logo/tv/mm/movie_plus_jp.png", Movie Plus (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs14
#EXTINF:-1 group-title="CS" tvg-id="home_drama" tvg-logo="https://www.lyngsat.com/logo/tv/hh/home-drama-channelpng-jp.png", Home Drama Channel (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs05
#EXTINF:-1 group-title="CS" tvg-id="tabi_channel" tvg-logo="https://www.lyngsat.com/logo/tv/tt/tabi_channel.png", Tabi Channel (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs12
#EXTINF:-1 group-title="CS" tvg-id="fuji_tv_next" tvg-logo="https://www.lyngsat.com/logo/tv/ff/fuji_tv_next.png", Fuji TV Next (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs26
#EXTINF:-1 group-title="CS" tvg-id="sky_a" tvg-logo="https://www.lyngsat-logo.com/logo/tv/ss/sky-a-jp.png", Sky A  (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs01
#EXTINF:-1 group-title="CS" tvg-id="gaora" tvg-logo="https://www.lyngsat-logo.com/logo/tv/gg/gaora-sportspng-jp.png", GAORA SPORTS (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs17
#EXTINF:-1 group-title="CS" tvg-id="golf_network" tvg-logo="https://www.lyngsat.com/logo/tv/gg/golf-network-jp.png", Golf Network (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs03
#EXTINF:-1 group-title="CS" tvg-id="ntv_plus" tvg-logo="https://www.lyngsat-logo.com/logo/tv/nn/ntv-g-plus-jp.png", Nittele G+ (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs02
#EXTINF:-1 group-title="CS" tvg-id="mondo_tv" tvg-logo="https://www.lyngsat.com/logo/tv/mm/mondo_tv_jp.png", Mondo TV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs21
#EXTINF:-1 group-title="CS" tvg-id="channel_ginga" tvg-logo="https://www.lyngsat.com/logo/tv/cc/channel_ginga.png", Channel Ginga (Primehome)
https://proxy.utako.moe/ph.php?&isp=2&id=cs29
#EXTINF:-1 group-title="CS" tvg-id="space_shower" tvg-logo="https://www.lyngsat.com/logo/tv/ss/space_shower_tv.png", Space Shower TV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=bs26
#EXTINF:-1 group-title="CS" tvg-id="music_japan_tv" tvg-logo="https://www.lyngsat.com/logo/tv/mm/music_japan_tv.png", Music Japan TV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs06
#EXTINF:-1 group-title="CS" tvg-id="kayo_pops" tvg-logo="https://www.lyngsat.com/logo/tv/kk/kayo-pops-jp.png", Kayo Pops (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs13
#EXTINF:-1 group-title="CS" tvg-id="mtv" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/MTV_2021_%28brand_version%29.svg/240px-MTV_2021_%28brand_version%29.svg.png", MTV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs18
#EXTINF:-1 group-title="CS" tvg-id="lala_tv" tvg-logo="https://www.lyngsat.com/logo/tv/ll/lala_tv.png", LaLa TV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs19
#EXTINF:-1 group-title="CS" tvg-id="sky_stage" tvg-logo="https://tvguide.myjcom.jp/monomedia/ch_logo/jcom/logo-65406-154-400x400.png", Takarazuka Sky Stage (Primehome)
https://proxy.utako.moe/ph.php?&isp=2&id=cs28
#EXTINF:-1 group-title="CS" tvg-id="kids_station" tvg-logo="https://www.lyngsat-logo.com/logo/tv/kk/kidsstation.png", Kids Staton TV (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs07
#EXTINF:-1 group-title="CS" tvg-id="cartoon_network" tvg-logo="https://www.lyngsat-logo.com/logo/tv/cc/cartoon-network-us.svg", Cartoon Network (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs25
#EXTINF:-1 group-title="CS" tvg-id="natgeo" tvg-logo="https://www.lyngsat.com/logo/tv/nn/national-geographic-us.svg", National Geographic Japan (Primehome) 
https://proxy.utako.moe/ph.php?&isp=1&id=cs10
#EXTINF:-1 group-title="CS" tvg-id="disney_junior" tvg-logo="https://www.lyngsat-logo.com/logo/tv/dd/disney_junior_us.png", Disney Junior (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs23
#EXTINF:-1 group-title="CS" tvg-id="discovery_channel" tvg-logo="https://www.lyngsat-logo.com/logo/tv/dd/discovery-channel-east-us.png", Discovery Channel (Primehome)  
https://proxy.utako.moe/ph.php?&isp=1&id=cs08
#EXTINF:-1 group-title="CS" tvg-id="animal_planet" tvg-logo="https://www.lyngsat.com/logo/tv/aa/animal-planet-us.svg", Animal Planet (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs24
#EXTINF:-1 group-title="CS" tvg-id="history_channel" tvg-logo="https://www.lyngsat.com/logo/tv/hh/history-us.svg", History (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs09
#EXTINF:-1 group-title="CS" tvg-id="cnn_j" tvg-logo="https://www.lyngsat.com/logo/tv/cc/cnn-j-us.svg", CNNj (Primehome) 
https://proxy.utako.moe/ph.php?&isp=1&id=cs16
#EXTINF:-1 group-title="CS" tvg-id="bbc_news" tvg-logo="https://en.wikipedia.org/wiki/File:BBC_Japan_Box_Ident.svg", BBC News (Primehome)  
https://proxy.utako.moe/ph.php?&isp=1&id=cs15
#EXTINF:-1 group-title="CS" tvg-id="tbs_news" tvg-logo="https://www.lyngsat.com/logo/tv/tt/tbs-news-jp.png", TBS News (Primehome)
https://proxy.utako.moe/ph.php?&isp=1&id=cs11
`;

const App: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [epgData, setEpgData] = useState<EpgData | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Programme | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(() => loadSettings().apiKey ?? null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [m3uUrl, setM3uUrl] = useState(() => loadSettings().m3uUrl ?? '');
  const [targetLanguage, setTargetLanguage] = useState(
    () => loadSettings().language ?? 'Português (Brasil)'
  );
  const [activeView, setActiveView] = useState<'iptv' | 'sdr'>('iptv');
  const [introSeen, setIntroSeen] = useState(() => loadSettings().introSeen ?? false);

  const handleIntroEnd = useCallback(() => {
    setIntroSeen(true);
    saveSettings({ introSeen: true });
  }, []);

  useEffect(() => {
    saveSettings({ language: targetLanguage });
  }, [targetLanguage]);

  useEffect(() => {
    if (!apiKey && !introSeen) {
      // Delay opening settings modal if intro is playing
      setTimeout(() => {
        setIsSettingsModalOpen(true);
      }, 500);
    }
  }, [apiKey, introSeen]);

  const handleSaveApiKey = (newApiKey: string) => {
    setApiKey(newApiKey);
    saveSettings({ apiKey: newApiKey });
    setIsSettingsModalOpen(false);
  };

  const processM3UContent = useCallback(async (m3uContent: string) => {
    setIsLoading(true);
    setError(null);
    setChannels([]);
    setSelectedChannel(null);
    setEpgData(null);
    setCurrentProgram(null);
    try {
        const { channels: parsedChannels, epgUrls } = parseM3U(m3uContent);
        if(parsedChannels.length === 0) {
          throw new Error('Nenhum canal encontrado na lista de reprodução ou o formato está incorreto.');
        }
        setChannels(parsedChannels);

        if (epgUrls.length > 0) {
          fetchAndParseEPG(epgUrls)
            .then(setEpgData)
            .catch(err => console.error("Falha ao carregar dados do EPG:", err));
        }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleUrlSubmit = useCallback(async (url: string) => {
    if (!url) {
      setError('Por favor, insira uma URL de lista de reprodução M3U válida.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setChannels([]);
    setSelectedChannel(null);
    setEpgData(null);
    setCurrentProgram(null);
    setM3uUrl(url);

    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Falha ao buscar a lista de reprodução: ${response.status} ${response.statusText}`);
      }
      const m3uContent = await response.text();
      await processM3UContent(m3uContent);
      saveSettings({ m3uUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setIsLoading(false);
    }
  }, [processM3UContent]);
  
  useEffect(() => {
    if (activeView === 'iptv') {
      const settings = loadSettings();
      if (settings.m3uUrl) {
        handleUrlSubmit(settings.m3uUrl);
      } else {
        processM3UContent(PRELOADED_SAMPLE_M3U);
      }
    }
  }, [handleUrlSubmit, processM3UContent, activeView]);


  const handleFileContent = (content: string) => {
    setM3uUrl(''); // Clear URL input when a file is loaded
    processM3UContent(content);
    saveSettings({ m3uUrl: '' });
  };

  const handleClearUrl = () => {
    setM3uUrl('');
    saveSettings({ m3uUrl: '' });
    processM3UContent(PRELOADED_SAMPLE_M3U);
  };

  const handleSelectChannel = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    setCurrentProgram(null);
  }, []);

  const renderIptvView = () => (
    <>
      <UrlInput 
          onSubmit={handleUrlSubmit} 
          onFileContent={handleFileContent} 
          isLoading={isLoading}
          m3uUrl={m3uUrl}
          onUrlChange={setM3uUrl}
          onClear={handleClearUrl}
      />
      {error && <p className="text-red-400 text-center mt-4 bg-red-900/50 p-3 rounded-md">{error}</p>}
      
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          <Player 
            channel={selectedChannel} 
            apiKey={apiKey}
            onInvalidApiKey={() => setIsSettingsModalOpen(true)}
            epgData={epgData}
            currentProgram={currentProgram}
            onProgramChange={setCurrentProgram}
            targetLanguage={targetLanguage}
            onLanguageChange={setTargetLanguage}
          />
          <ProgramInfo 
            channel={selectedChannel} 
            program={currentProgram}
            targetLanguage={targetLanguage}
            apiKey={apiKey}
          />
        </div>
        <div className="lg:col-span-4 xl:col-span-3">
          <ChannelList channels={channels} onSelectChannel={handleSelectChannel} selectedChannelUrl={selectedChannel?.url} />
        </div>
      </div>
    </>
  );

  const renderSdrView = () => (
    <KiwiSdrView 
      apiKey={apiKey}
      onInvalidApiKey={() => setIsSettingsModalOpen(true)}
      targetLanguage={targetLanguage}
      onLanguageChange={setTargetLanguage}
    />
  );

  const ViewButton = ({ view, label, icon }: { view: 'iptv' | 'sdr', label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        activeView === view
          ? 'bg-teal-500/20 text-teal-300'
          : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  if (!introSeen) {
    return <IntroAnimation onEnd={handleIntroEnd} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm shadow-lg p-4 sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
              Player com IA
            </h1>
            <div className="hidden sm:flex items-center gap-2 bg-gray-700/30 p-1 rounded-lg">
              <ViewButton view="iptv" label="IPTV" icon={<TvIcon />} />
              <ViewButton view="sdr" label="Rádio IA" icon={<RadioIcon />} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-400 hidden sm:block">Dublagem e Legendas com IA do Gemini</p>
            <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                title="Configurações"
            >
                <SettingsIcon />
            </button>
          </div>
        </div>
         <div className="sm:hidden container mx-auto flex items-center justify-center mt-3 bg-gray-700/30 p-1 rounded-lg">
            <ViewButton view="iptv" label="IPTV" icon={<TvIcon />} />
            <ViewButton view="sdr" label="Rádio IA" icon={<RadioIcon />} />
        </div>
      </header>

      <main className="container mx-auto p-4 flex-grow flex flex-col">
        {!apiKey && (
            <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 px-4 py-3 rounded-lg relative mb-4 text-center" role="alert">
                <strong className="font-bold">Ação necessária:</strong>
                <span className="block sm:inline ml-2">As funções de IA estão desativadas. Por favor, 
                    <button onClick={() => setIsSettingsModalOpen(true)} className="font-bold underline hover:text-yellow-100 mx-1">
                        adicione sua chave de API do Gemini
                    </button> 
                para continuar.</span>
            </div>
        )}
        
        {activeView === 'iptv' ? renderIptvView() : renderSdrView()}

      </main>
      <footer className="bg-gray-800 text-center p-4 text-sm text-gray-500 mt-8">
        <p>&copy; {new Date().getFullYear()} Player de IPTV com IA. Desenvolvido com a API do Gemini.</p>
      </footer>
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveApiKey}
        currentApiKey={apiKey}
      />
    </div>
  );
};

export default App;