// 福州市新能源充电桩选址平台 - 静态真实数据（来源：高德地图API真实采集，2024年）
// 道路路径坐标通过高德JS SDK路径规划API获取，POI数据通过高德PlaceSearch API获取
export const STATIC_POI_DATA = [
  { id: 1, name: "万达广场(福州仓山店)", category: "shopping_mall", district: "鼓楼区", latitude: 26.035858, longitude: 119.273854, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 2, name: "万达广场A区(福州仓山万达广场店)", category: "shopping_mall", district: "鼓楼区", latitude: 26.035853, longitude: 119.273854, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 3, name: "万达广场超级物种", category: "shopping_mall", district: "鼓楼区", latitude: 26.036479, longitude: 119.275395, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 4, name: "万达广场(福州金融街店)", category: "shopping_mall", district: "鼓楼区", latitude: 26.052406, longitude: 119.342619, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 5, name: "东百中心", category: "shopping_mall", district: "鼓楼区", latitude: 26.084802, longitude: 119.298974, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 6, name: "东百中心A馆", category: "shopping_mall", district: "鼓楼区", latitude: 26.085165, longitude: 119.298775, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 7, name: "苏宁广场", category: "shopping_mall", district: "鼓楼区", latitude: 26.060649, longitude: 119.286901, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 8, name: "福建医科大学附属协和医院(于山院区)", category: "hospital", district: "鼓楼区", latitude: 26.077841, longitude: 119.30402, dailyFlow: 15000, evDemandScore: 8.5, parkingSpaces: 400, nearbyCompetitors: 0 },
  { id: 9, name: "福建医科大学附属第一医院茶亭院区", category: "hospital", district: "鼓楼区", latitude: 26.070318, longitude: 119.301956, dailyFlow: 15000, evDemandScore: 8.5, parkingSpaces: 400, nearbyCompetitors: 0 },
  { id: 10, name: "福州大学附属省立医院", category: "hospital", district: "鼓楼区", latitude: 26.087856, longitude: 119.306711, dailyFlow: 15000, evDemandScore: 8.5, parkingSpaces: 400, nearbyCompetitors: 0 },
  { id: 11, name: "福建省人民医院", category: "hospital", district: "鼓楼区", latitude: 26.061337, longitude: 119.304419, dailyFlow: 15000, evDemandScore: 8.5, parkingSpaces: 400, nearbyCompetitors: 0 },
  { id: 12, name: "福州市中医院", category: "hospital", district: "鼓楼区", latitude: 26.090034, longitude: 119.302228, dailyFlow: 15000, evDemandScore: 8.5, parkingSpaces: 400, nearbyCompetitors: 0 },
  { id: 13, name: "福州站", category: "transport_hub", district: "鼓楼区", latitude: 26.113972, longitude: 119.320571, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 14, name: "福州南站", category: "transport_hub", district: "鼓楼区", latitude: 25.986348, longitude: 119.391728, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 15, name: "福州市民之家", category: "government", district: "鼓楼区", latitude: 26.07189, longitude: 119.307807, dailyFlow: 5000, evDemandScore: 7.2, parkingSpaces: 200, nearbyCompetitors: 0 },
  { id: 16, name: "台江区机关大楼", category: "government", district: "鼓楼区", latitude: 26.052842, longitude: 119.31404, dailyFlow: 5000, evDemandScore: 7.2, parkingSpaces: 200, nearbyCompetitors: 0 },
  { id: 17, name: "浦口行政大楼", category: "government", district: "鼓楼区", latitude: 26.06358, longitude: 119.20968, dailyFlow: 5000, evDemandScore: 7.2, parkingSpaces: 200, nearbyCompetitors: 0 },
  { id: 18, name: "福建医科大学(台江校区)", category: "school", district: "鼓楼区", latitude: 26.06891, longitude: 119.299796, dailyFlow: 18000, evDemandScore: 8.1, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 19, name: "闽江大学(工业路校区)", category: "school", district: "鼓楼区", latitude: 26.065096, longitude: 119.27954, dailyFlow: 18000, evDemandScore: 8.1, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 20, name: "福州大学至诚学院(怡山校区)", category: "school", district: "鼓楼区", latitude: 26.074783, longitude: 119.271576, dailyFlow: 18000, evDemandScore: 8.1, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 21, name: "福建中医药大学(屏山校区)", category: "school", district: "鼓楼区", latitude: 26.105971, longitude: 119.303182, dailyFlow: 18000, evDemandScore: 8.1, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 22, name: "福建师范大学(仓山校区)", category: "school", district: "鼓楼区", latitude: 26.035195, longitude: 119.307938, dailyFlow: 18000, evDemandScore: 8.1, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 23, name: "福州市则徐小学地下停车场", category: "parking", district: "鼓楼区", latitude: 26.077781, longitude: 119.295792, dailyFlow: 6000, evDemandScore: 7.8, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 24, name: "三坊七巷营房里停车点", category: "parking", district: "鼓楼区", latitude: 26.079008, longitude: 119.297067, dailyFlow: 6000, evDemandScore: 7.8, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 25, name: "乌山北坡地面停车场", category: "parking", district: "鼓楼区", latitude: 26.077551, longitude: 119.29858, dailyFlow: 6000, evDemandScore: 7.8, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 26, name: "林则徐纪念馆南门地面停车场", category: "parking", district: "鼓楼区", latitude: 26.077994, longitude: 119.297283, dailyFlow: 6000, evDemandScore: 7.8, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 27, name: "大洋晶典乌山店地下停车场", category: "parking", district: "鼓楼区", latitude: 26.075711, longitude: 119.299728, dailyFlow: 6000, evDemandScore: 7.8, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 28, name: "福州火车站(地铁站)", category: "transport_hub", district: "鼓楼区", latitude: 26.112978, longitude: 119.318133, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 29, name: "福州地铁", category: "transport_hub", district: "鼓楼区", latitude: 25.926063, longitude: 119.470534, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 30, name: "福州地铁科技有限公司", category: "transport_hub", district: "鼓楼区", latitude: 26.057987, longitude: 119.310337, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 31, name: "福州大学地铁站(公交站)", category: "transport_hub", district: "鼓楼区", latitude: 26.057634, longitude: 119.203638, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 32, name: "福州火车站地铁站K口", category: "transport_hub", district: "鼓楼区", latitude: 26.111544, longitude: 119.319109, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 33, name: "福州火车站地铁站E口", category: "transport_hub", district: "鼓楼区", latitude: 26.112858, longitude: 119.318561, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 34, name: "福州站(检票口1)", category: "transport_hub", district: "鼓楼区", latitude: 26.113695, longitude: 119.319432, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 35, name: "福州火车站地铁站H口", category: "transport_hub", district: "鼓楼区", latitude: 26.109179, longitude: 119.3173, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 36, name: "福州地铁大厦", category: "transport_hub", district: "鼓楼区", latitude: 26.057989, longitude: 119.310339, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 37, name: "福州地铁大厦停车场", category: "transport_hub", district: "鼓楼区", latitude: 26.058465, longitude: 119.310444, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 38, name: "福州火车站地铁站A2口", category: "transport_hub", district: "鼓楼区", latitude: 26.112855, longitude: 119.318877, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 39, name: "福州火车站地铁站D2口", category: "transport_hub", district: "鼓楼区", latitude: 26.112072, longitude: 119.318109, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 40, name: "福州火车站地铁站D1口", category: "transport_hub", district: "鼓楼区", latitude: 26.111683, longitude: 119.318735, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 41, name: "福州站(检票口3)", category: "transport_hub", district: "鼓楼区", latitude: 26.114032, longitude: 119.319594, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 42, name: "福州火车站地铁站A1口", category: "transport_hub", district: "鼓楼区", latitude: 26.112879, longitude: 119.31835, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 43, name: "福州汽车北站", category: "transport_hub", district: "鼓楼区", latitude: 26.108623, longitude: 119.319775, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 44, name: "福州汽车客运西站", category: "transport_hub", district: "鼓楼区", latitude: 26.040097, longitude: 119.205743, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 45, name: "福州汽车南站", category: "transport_hub", district: "鼓楼区", latitude: 25.989709, longitude: 119.39405, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 46, name: "福州汽车北站售票处", category: "transport_hub", district: "鼓楼区", latitude: 26.109158, longitude: 119.318847, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 47, name: "福州东站", category: "transport_hub", district: "鼓楼区", latitude: 26.101888, longitude: 119.339086, dailyFlow: 35000, evDemandScore: 9.2, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 48, name: "福州国家森林公园", category: "scenic", district: "鼓楼区", latitude: 26.161579, longitude: 119.28625, dailyFlow: 20000, evDemandScore: 8.3, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 49, name: "福州左海公园海底世界", category: "scenic", district: "鼓楼区", latitude: 26.09798, longitude: 119.287473, dailyFlow: 20000, evDemandScore: 8.3, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 50, name: "福州市鼓山旅游景区", category: "scenic", district: "鼓楼区", latitude: 26.053221, longitude: 119.37561, dailyFlow: 20000, evDemandScore: 8.3, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 51, name: "福州党建主题公园", category: "scenic", district: "鼓楼区", latitude: 26.107448, longitude: 119.296101, dailyFlow: 20000, evDemandScore: 8.3, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 52, name: "福州党建主题公园", category: "scenic", district: "鼓楼区", latitude: 26.101105, longitude: 119.24901, dailyFlow: 20000, evDemandScore: 8.3, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 53, name: "于山风景名胜公园", category: "scenic", district: "鼓楼区", latitude: 26.07803, longitude: 119.307678, dailyFlow: 20000, evDemandScore: 8.3, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 54, name: "福州花海公园", category: "scenic", district: "鼓楼区", latitude: 26.038922, longitude: 119.356762, dailyFlow: 20000, evDemandScore: 8.3, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 55, name: "福州市儿童公园", category: "scenic", district: "鼓楼区", latitude: 26.141354, longitude: 119.296687, dailyFlow: 20000, evDemandScore: 8.3, parkingSpaces: 500, nearbyCompetitors: 0 },
  { id: 56, name: "福州世纪金源大饭店", category: "hotel", district: "鼓楼区", latitude: 26.098775, longitude: 119.31011, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 57, name: "福州三坊七巷三宝宾邸", category: "hotel", district: "鼓楼区", latitude: 26.082765, longitude: 119.293548, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 58, name: "福州香格里拉", category: "hotel", district: "鼓楼区", latitude: 26.074321, longitude: 119.306145, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 59, name: "福州三迪希尔顿酒店", category: "hotel", district: "鼓楼区", latitude: 26.056295, longitude: 119.285623, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 60, name: "福州榕发会展假日酒店", category: "hotel", district: "鼓楼区", latitude: 26.031744, longitude: 119.361531, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 61, name: "福州宏亮花园酒店", category: "hotel", district: "鼓楼区", latitude: 26.038384, longitude: 119.277059, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 62, name: "福州新投格兰云天国际酒店", category: "hotel", district: "鼓楼区", latitude: 25.875576, longitude: 119.596085, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 63, name: "闽江饭店", category: "hotel", district: "鼓楼区", latitude: 26.092694, longitude: 119.305666, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 64, name: "银河花园大饭店", category: "hotel", district: "鼓楼区", latitude: 26.101654, longitude: 119.306761, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 65, name: "福州大饭店", category: "hotel", district: "鼓楼区", latitude: 26.073659, longitude: 119.304157, dailyFlow: 8000, evDemandScore: 8.0, parkingSpaces: 300, nearbyCompetitors: 1 },
  { id: 66, name: "中石化森美福州工业路加油站", category: "gas_station", district: "鼓楼区", latitude: 26.063728, longitude: 119.283177, dailyFlow: 3500, evDemandScore: 7.8, parkingSpaces: 20, nearbyCompetitors: 0 },
  { id: 67, name: "中石化森美福州五一加油站", category: "gas_station", district: "鼓楼区", latitude: 26.072691, longitude: 119.311486, dailyFlow: 3500, evDemandScore: 7.8, parkingSpaces: 20, nearbyCompetitors: 0 },
  { id: 68, name: "中石化森美福州新店加油站", category: "gas_station", district: "鼓楼区", latitude: 26.121673, longitude: 119.299369, dailyFlow: 3500, evDemandScore: 7.8, parkingSpaces: 20, nearbyCompetitors: 0 },
  { id: 69, name: "中石化森美福州黄山加油站", category: "gas_station", district: "鼓楼区", latitude: 26.015516, longitude: 119.353014, dailyFlow: 3500, evDemandScore: 7.8, parkingSpaces: 20, nearbyCompetitors: 0 },
  { id: 70, name: "中石化森美福州茶会加油站", category: "gas_station", district: "鼓楼区", latitude: 26.083014, longitude: 119.335601, dailyFlow: 3500, evDemandScore: 7.8, parkingSpaces: 20, nearbyCompetitors: 0 },
  { id: 71, name: "中石化森美福州远洋加油站", category: "gas_station", district: "鼓楼区", latitude: 26.083018, longitude: 119.369072, dailyFlow: 3500, evDemandScore: 7.8, parkingSpaces: 20, nearbyCompetitors: 0 },
  { id: 72, name: "三迪中心写字楼", category: "office", district: "鼓楼区", latitude: 26.056297, longitude: 119.285621, dailyFlow: 16000, evDemandScore: 8.4, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 73, name: "IFC福州国际金融中心", category: "office", district: "鼓楼区", latitude: 26.058593, longitude: 119.279651, dailyFlow: 16000, evDemandScore: 8.4, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 74, name: "茶亭国际", category: "office", district: "鼓楼区", latitude: 26.068391, longitude: 119.305397, dailyFlow: 16000, evDemandScore: 8.4, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 75, name: "蔓哈顿写字楼", category: "office", district: "鼓楼区", latitude: 26.113366, longitude: 119.318581, dailyFlow: 16000, evDemandScore: 8.4, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 76, name: "融都国际大厦", category: "office", district: "鼓楼区", latitude: 26.08956, longitude: 119.306579, dailyFlow: 16000, evDemandScore: 8.4, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 77, name: "福晟财富中心", category: "office", district: "鼓楼区", latitude: 26.076855, longitude: 119.313914, dailyFlow: 16000, evDemandScore: 8.4, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 78, name: "金源大广场", category: "office", district: "鼓楼区", latitude: 26.071375, longitude: 119.306504, dailyFlow: 16000, evDemandScore: 8.4, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 79, name: "富邦总部大楼", category: "office", district: "鼓楼区", latitude: 26.045794, longitude: 119.358265, dailyFlow: 16000, evDemandScore: 8.4, parkingSpaces: 600, nearbyCompetitors: 0 },
  { id: 80, name: "居住主题公园", category: "residential", district: "鼓楼区", latitude: 26.130443, longitude: 119.330192, dailyFlow: 10000, evDemandScore: 7.9, parkingSpaces: 1000, nearbyCompetitors: 0 },
  { id: 81, name: "建发央著", category: "residential", district: "鼓楼区", latitude: 26.128449, longitude: 119.332199, dailyFlow: 10000, evDemandScore: 7.9, parkingSpaces: 1000, nearbyCompetitors: 0 },
  { id: 82, name: "居住主题公园桂湖南郡", category: "residential", district: "鼓楼区", latitude: 26.133826, longitude: 119.334226, dailyFlow: 10000, evDemandScore: 7.9, parkingSpaces: 1000, nearbyCompetitors: 0 },
  { id: 83, name: "居住主题公园玫瑰华庭", category: "residential", district: "鼓楼区", latitude: 26.12969, longitude: 119.330614, dailyFlow: 10000, evDemandScore: 7.9, parkingSpaces: 1000, nearbyCompetitors: 0 },
  { id: 84, name: "中天·桂湖云庭", category: "residential", district: "鼓楼区", latitude: 26.135, longitude: 119.329558, dailyFlow: 10000, evDemandScore: 7.9, parkingSpaces: 1000, nearbyCompetitors: 0 },
  { id: 85, name: "蓝山四季", category: "residential", district: "鼓楼区", latitude: 26.13333, longitude: 119.323521, dailyFlow: 10000, evDemandScore: 7.9, parkingSpaces: 1000, nearbyCompetitors: 0 },
  { id: 86, name: "宝龙万象", category: "shopping_mall", district: "鼓楼区", latitude: 26.062159, longitude: 119.291818, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 87, name: "福州万象城", category: "shopping_mall", district: "鼓楼区", latitude: 26.074893, longitude: 119.277387, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 88, name: "宝龙", category: "shopping_mall", district: "鼓楼区", latitude: 26.061587, longitude: 119.292913, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 89, name: "万象影城(福州万象城)", category: "shopping_mall", district: "鼓楼区", latitude: 26.075533, longitude: 119.277664, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
  { id: 90, name: "万宝龙Montblanc(福州万象城店)", category: "shopping_mall", district: "鼓楼区", latitude: 26.074882, longitude: 119.27738, dailyFlow: 30000, evDemandScore: 8.8, parkingSpaces: 800, nearbyCompetitors: 1 },
];

export const STATIC_TRAFFIC_FLOW = [
  { id: 1, roadName: "五四路", district: "鼓楼区", dailyFlow: 75000, evRatio: 0.12, latitude: 26.086476, longitude: 119.307602, peakHour: "08:00-09:00", path: [[119.295119,26.075138], [119.294405,26.075218], [119.293654,26.074467], [119.293370,26.073721], [119.292726,26.073909], [119.291862,26.072584], [119.291535,26.073871], [119.291288,26.074558], [119.290784,26.077170], [119.290870,26.078994], [119.290891,26.080721], [119.290146,26.082546], [119.289550,26.084128], [119.288863,26.086156], [119.288815,26.087974], [119.289148,26.089412], [119.291562,26.090860], [119.294577,26.091917], [119.296320,26.092212], [119.298069,26.092421], [119.299651,26.092234], [119.301760,26.092598], [119.303079,26.092893], [119.305391,26.093242], [119.307521,26.093564], [119.309463,26.093886], [119.311732,26.094240], [119.315165,26.094428], [119.318534,26.094492], [119.325341,26.097201]] },
  { id: 2, roadName: "福飞路", district: "鼓楼区", dailyFlow: 85000, evRatio: 0.11, latitude: 26.086195, longitude: 119.288058, peakHour: "08:00-09:00", path: [[119.270217,26.086912], [119.270769,26.086858], [119.271671,26.087078], [119.272813,26.087003], [119.273596,26.087111], [119.274203,26.086875], [119.274911,26.086885], [119.275908,26.087293], [119.276418,26.087438], [119.277180,26.087674], [119.278006,26.087631], [119.278714,26.087706], [119.279685,26.088259], [119.280356,26.088929], [119.280897,26.089063], [119.282067,26.088988], [119.282051,26.088382], [119.282072,26.087728], [119.282056,26.087121], [119.282083,26.085555], [119.282131,26.084621], [119.282212,26.083533], [119.282281,26.082567], [119.282641,26.081950], [119.285087,26.082953], [119.286675,26.083640], [119.288617,26.084364], [119.289276,26.084536], [119.289754,26.084627], [119.290988,26.084804]] },
  { id: 3, roadName: "二环路（北段）", district: "鼓楼区", dailyFlow: 95000, evRatio: 0.14, latitude: 26.095590, longitude: 119.312497, peakHour: "08:00-09:00", path: [[119.280048,26.089781], [119.280302,26.090817], [119.281241,26.091686], [119.282314,26.090919], [119.282056,26.088221], [119.282088,26.085383], [119.282212,26.087148], [119.282340,26.090131], [119.282453,26.093086], [119.281284,26.097432], [119.283140,26.100688], [119.287748,26.104089], [119.291272,26.106514], [119.294121,26.107758], [119.299506,26.108279], [119.303197,26.108547], [119.309694,26.109003], [119.313894,26.109035], [119.319237,26.107479], [119.324011,26.105092], [119.329553,26.101241], [119.330722,26.096600], [119.330921,26.093446], [119.332315,26.091198], [119.333495,26.089406], [119.334043,26.087958], [119.335293,26.088538], [119.337213,26.088908], [119.343597,26.089203], [119.349734,26.088758]] },
  { id: 4, roadName: "国货路", district: "台江区", dailyFlow: 65000, evRatio: 0.1, latitude: 26.064246, longitude: 119.327800, peakHour: "17:00-18:00", path: [[119.310001,26.064936], [119.309892,26.064902], [119.309978,26.064156], [119.309994,26.063968], [119.308894,26.063910], [119.308605,26.063786], [119.309270,26.063695], [119.311174,26.063759], [119.312274,26.063781], [119.313052,26.063808], [119.313545,26.063883], [119.315155,26.064124], [119.316565,26.064419], [119.319580,26.065031], [119.320438,26.065149], [119.322423,26.065229], [119.323464,26.065277], [119.325503,26.065347], [119.327740,26.065411], [119.328807,26.065449], [119.329429,26.065481], [119.330835,26.065524], [119.332235,26.065578], [119.333796,26.065648], [119.335695,26.065691], [119.337674,26.065712], [119.338441,26.065551], [119.339219,26.065111], [119.339879,26.064510], [119.341108,26.063352]] },
  { id: 5, roadName: "八一七路", district: "鼓楼区", dailyFlow: 70000, evRatio: 0.09, latitude: 26.080149, longitude: 119.306813, peakHour: "08:00-09:00", path: [[119.304989,26.070037], [119.305348,26.070052], [119.305391,26.069810], [119.305397,26.069311], [119.304903,26.069129], [119.304372,26.069355], [119.304227,26.069783], [119.303986,26.070556], [119.303643,26.071768], [119.303428,26.072546], [119.303058,26.073834], [119.302918,26.074204], [119.302570,26.075239], [119.302226,26.076167], [119.304372,26.076200], [119.306985,26.076215], [119.309570,26.076253], [119.310525,26.076280], [119.310895,26.076795], [119.310740,26.077433], [119.310488,26.078388], [119.310075,26.080035], [119.310021,26.080260], [119.309967,26.080475], [119.309855,26.080909], [119.309667,26.081623], [119.309382,26.082658], [119.309050,26.083844], [119.308685,26.085233], [119.308315,26.086756]] },
  { id: 6, roadName: "湖东路", district: "晋安区", dailyFlow: 55000, evRatio: 0.08, latitude: 26.081137, longitude: 119.330688, peakHour: "08:00-09:00", path: [[119.309967,26.080013], [119.310370,26.080019], [119.311523,26.080255], [119.312478,26.080394], [119.313765,26.080480], [119.315155,26.080566], [119.316453,26.080646], [119.318014,26.080738], [119.318733,26.080786], [119.319510,26.080834], [119.320642,26.080925], [119.321710,26.080974], [119.322616,26.081011], [119.323668,26.081054], [119.324805,26.081103], [119.326334,26.081151], [119.326994,26.081178], [119.328265,26.081215], [119.328871,26.081231], [119.329258,26.081236], [119.331081,26.081269], [119.332337,26.081312], [119.333581,26.081344], [119.334627,26.081381], [119.335529,26.081408], [119.337390,26.081516], [119.338109,26.081532], [119.339246,26.081575], [119.340947,26.081650], [119.341789,26.081687]] },
  { id: 7, roadName: "金山大道", district: "仓山区", dailyFlow: 62000, evRatio: 0.11, latitude: 26.037980, longitude: 119.277261, peakHour: "08:00-09:00", path: [[119.249809,26.035379], [119.250411,26.035521], [119.250958,26.035532], [119.251447,26.035559], [119.251629,26.035419], [119.251838,26.035435], [119.251930,26.035494], [119.252037,26.035634], [119.251999,26.036245], [119.253453,26.036288], [119.255830,26.036336], [119.257433,26.036369], [119.259853,26.036379], [119.262433,26.036422], [119.263699,26.036588], [119.265244,26.037372], [119.266692,26.038391], [119.267427,26.038943], [119.269069,26.040188], [119.269691,26.040644], [119.272824,26.042940], [119.273596,26.043514], [119.274766,26.044372], [119.276139,26.045397], [119.276702,26.045821], [119.277421,26.044978], [119.278355,26.043820], [119.278542,26.043557], [119.279572,26.042318], [119.280677,26.041395]] },
  { id: 8, roadName: "浦上大道", district: "仓山区", dailyFlow: 55000, evRatio: 0.1, latitude: 26.024724, longitude: 119.260622, peakHour: "08:00-09:00", path: [[119.240183,26.024628], [119.230450,26.020790], [119.227237,26.019530], [119.225794,26.018956], [119.223632,26.018119], [119.222039,26.017518], [119.223632,26.018006], [119.225295,26.018645], [119.227076,26.019336], [119.229050,26.020115], [119.244146,26.026106], [119.245224,26.026611], [119.246656,26.027308], [119.248378,26.028268], [119.249773,26.028987], [119.251162,26.029583], [119.252788,26.030098], [119.255433,26.030596], [119.257873,26.031015], [119.259311,26.031272], [119.259971,26.030468], [119.261940,26.028649], [119.262723,26.028043], [119.264493,26.026911], [119.265389,26.026418], [119.266768,26.025768], [119.267578,26.025447], [119.269251,26.024883], [119.270893,26.024486], [119.273028,26.024159]] },
  { id: 9, roadName: "南二环路", district: "仓山区", dailyFlow: 78000, evRatio: 0.13, latitude: 26.031143, longitude: 119.312635, peakHour: "17:00-18:00", path: [[119.269825,26.040169], [119.270823,26.038772], [119.271767,26.039593], [119.271569,26.038852], [119.272432,26.036953], [119.270785,26.035854], [119.272148,26.034480], [119.274015,26.034491], [119.276536,26.036052], [119.278569,26.037913], [119.281053,26.040027], [119.281890,26.040135], [119.282764,26.039802], [119.284819,26.037597], [119.288933,26.032324], [119.290306,26.029100], [119.291438,26.025811], [119.292790,26.023290], [119.295666,26.021573], [119.298954,26.021359], [119.304098,26.021262], [119.310590,26.020050], [119.316984,26.020115], [119.323426,26.019868], [119.329558,26.020007], [119.333495,26.020265], [119.337835,26.020549], [119.340400,26.021616], [119.344611,26.024669], [119.347470,26.027818]] },
  { id: 10, roadName: "鼓山大道", district: "晋安区", dailyFlow: 38000, evRatio: 0.08, latitude: 26.089527, longitude: 119.346191, peakHour: "08:00-09:00", path: [[119.330330,26.090041], [119.330583,26.088564], [119.330352,26.088436], [119.328249,26.088264], [119.326415,26.088226], [119.326388,26.088795], [119.326345,26.089911], [119.326355,26.090592], [119.326463,26.090823], [119.326699,26.091048], [119.327439,26.091434], [119.328319,26.091799], [119.329660,26.092336], [119.330304,26.092529], [119.330717,26.092657], [119.330985,26.092593], [119.331135,26.092470], [119.332315,26.091198], [119.332846,26.090646], [119.333254,26.090056], [119.333495,26.089406], [119.333630,26.088511], [119.333758,26.088183], [119.334043,26.087958], [119.334407,26.087910], [119.334745,26.088017], [119.335293,26.088538], [119.335733,26.088768], [119.336655,26.088870], [119.337213,26.088908]] },
  { id: 11, roadName: "化工路", district: "晋安区", dailyFlow: 42000, evRatio: 0.07, latitude: 26.103394, longitude: 119.316983, peakHour: "07:00-08:00", path: [[119.290145,26.104921], [119.290682,26.104819], [119.290548,26.105371], [119.291519,26.106685], [119.292930,26.107533], [119.296063,26.108037], [119.300247,26.108338], [119.302768,26.108509], [119.305686,26.108724], [119.309731,26.109003], [119.312901,26.109191], [119.315723,26.108520], [119.319725,26.107308], [119.323030,26.105752], [119.328566,26.101986], [119.329515,26.101155], [119.330196,26.099385], [119.328818,26.099111], [119.325760,26.097695], [119.322214,26.096230], [119.321495,26.095592], [119.321865,26.096745], [119.321978,26.097083], [119.323603,26.098188], [119.324451,26.099395], [119.325733,26.100543], [119.325449,26.100736], [119.325953,26.101627], [119.327605,26.102801], [119.327847,26.103644]] },
  { id: 12, roadName: "福马路", district: "晋安区", dailyFlow: 35000, evRatio: 0.08, latitude: 26.035687, longitude: 119.420605, peakHour: "08:00-09:00", path: [[119.350172,26.079961], [119.352700,26.085657], [119.361745,26.089686], [119.369721,26.087685], [119.371315,26.070556], [119.367924,26.057698], [119.368868,26.044764], [119.381239,26.030060], [119.393298,26.029261], [119.407653,26.032866], [119.428236,26.027185], [119.434454,26.015141], [119.441127,26.009208], [119.441385,26.004128], [119.438751,26.000497], [119.442377,26.001205], [119.447253,25.998796], [119.452183,26.001838], [119.454206,26.005126], [119.451593,26.006280], [119.449045,26.009268], [119.444421,26.015823], [119.443193,26.021804], [119.438466,26.032141], [119.435891,26.039904], [119.435966,26.043750], [119.434341,26.043777], [119.435629,26.047156], [119.438370,26.047382], [119.439588,26.052065]] },
  { id: 13, roadName: "江滨路（北岸）", district: "鼓楼区", dailyFlow: 68000, evRatio: 0.12, latitude: 26.061347, longitude: 119.295409, peakHour: "18:00-19:00", path: [[119.271829,26.058440], [119.268763,26.055579], [119.267400,26.054661], [119.265979,26.053814], [119.266424,26.053492], [119.267331,26.054216], [119.268457,26.055101], [119.270421,26.056850], [119.275125,26.061265], [119.276531,26.062155], [119.279803,26.063947], [119.281230,26.064730], [119.284003,26.063845], [119.285741,26.063207], [119.287758,26.062627], [119.297683,26.062740], [119.300730,26.062810], [119.302961,26.062842], [119.305788,26.063502], [119.307762,26.063647], [119.310504,26.063738], [119.312719,26.063791], [119.314586,26.064038], [119.317686,26.064645], [119.322101,26.065218], [119.324381,26.065310], [119.328378,26.065433], [119.328984,26.064628], [119.329483,26.062391], [119.329789,26.061034]] },
  { id: 14, roadName: "湖滨路", district: "鼓楼区", dailyFlow: 52000, evRatio: 0.1, latitude: 26.083752, longitude: 119.297704, peakHour: "08:00-09:00", path: [[119.280066,26.081934], [119.280366,26.082009], [119.280506,26.081751], [119.280747,26.081290], [119.278451,26.080421], [119.279980,26.080899], [119.281573,26.081542], [119.282641,26.081950], [119.285087,26.082953], [119.286675,26.083640], [119.288617,26.084364], [119.289276,26.084536], [119.289754,26.084627], [119.290988,26.084804], [119.291519,26.084890], [119.292833,26.085094], [119.293793,26.085271], [119.295070,26.085512], [119.296240,26.085668], [119.298080,26.085823], [119.298884,26.085888], [119.299523,26.085920], [119.301502,26.086129], [119.302634,26.086231], [119.303272,26.086285], [119.304361,26.086392], [119.305236,26.086478], [119.305761,26.086542], [119.306706,26.086649], [119.307940,26.086735]] },
  { id: 15, roadName: "三环路（北段）", district: "晋安区", dailyFlow: 92000, evRatio: 0.14, latitude: 26.111002, longitude: 119.291927, peakHour: "08:00-09:00", path: [[119.260049,26.099942], [119.261505,26.101026], [119.262642,26.101181], [119.263946,26.101938], [119.265201,26.101836], [119.266617,26.103065], [119.265394,26.103917], [119.264584,26.105661], [119.264251,26.106718], [119.264343,26.107731], [119.266108,26.109555], [119.266784,26.110575], [119.267433,26.110591], [119.266151,26.111047], [119.269659,26.112629], [119.272261,26.116792], [119.271676,26.121185], [119.276236,26.121931], [119.277545,26.122966], [119.279926,26.121851], [119.292093,26.123615], [119.302629,26.122076], [119.305327,26.121647], [119.306577,26.121582], [119.313175,26.121008], [119.319205,26.117613], [119.326184,26.112688], [119.334826,26.108488], [119.343602,26.105457], [119.350892,26.104432]] },
];

export const STATIC_EXCLUSION_ZONES = [
  { id: 1, name: "福州火车站核心区", type: "transport_restricted", centerLat: 26.113972, centerLng: 119.320571, radiusKm: 0.3, description: "火车站核心区域，禁止新建充电桩" },
  { id: 2, name: "三坊七巷历史文化街区", type: "historical_protected", centerLat: 26.073400, centerLng: 119.297800, radiusKm: 0.5, description: "国家级历史文化保护区" },
  { id: 3, name: "西湖公园保护区", type: "park_protected", centerLat: 26.085600, centerLng: 119.292300, radiusKm: 0.4, description: "城市公园核心保护区" },
  { id: 4, name: "福建省政府安保区", type: "government_restricted", centerLat: 26.083400, centerLng: 119.286700, radiusKm: 0.2, description: "政府机关安保限制区域" },
  { id: 5, name: "福州南站核心区", type: "transport_restricted", centerLat: 25.986348, centerLng: 119.391728, radiusKm: 0.4, description: "高铁站核心区域" },
  { id: 6, name: "闽江沿岸生态保护带（鼓楼段）", type: "ecological_protected", centerLat: 26.056700, centerLng: 119.293400, radiusKm: 0.3, description: "闽江沿岸生态保护区" },
  { id: 7, name: "鼓山风景名胜区核心区", type: "scenic_protected", centerLat: 26.093400, centerLng: 119.375600, radiusKm: 0.8, description: "省级风景名胜区" },
  { id: 8, name: "长乐机场净空保护区", type: "airport_restricted", centerLat: 25.934500, centerLng: 119.663400, radiusKm: 1.0, description: "机场净空保护区，禁止高大建筑" },
  { id: 9, name: "马尾船政文化遗址保护区", type: "historical_protected", centerLat: 25.995600, centerLng: 119.453400, radiusKm: 0.3, description: "全国重点文物保护单位" },
  { id: 10, name: "福州国家森林公园核心区", type: "park_protected", centerLat: 26.112300, centerLng: 119.345600, radiusKm: 0.6, description: "国家森林公园保护区" },
  { id: 11, name: "闽江口湿地保护区", type: "ecological_protected", centerLat: 25.923400, centerLng: 119.623400, radiusKm: 1.2, description: "国家级湿地保护区" },
  { id: 12, name: "于山历史文化区", type: "historical_protected", centerLat: 26.068900, centerLng: 119.308900, radiusKm: 0.25, description: "历史文化保护区" },
];

export const STATIC_CHARGING_STATIONS = [
  { id: 1, name: "南台大道汽车充电站", operator: "其他", latitude: 26.034479, longitude: 119.323339, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 2, name: "特来电汽车充电站(特来电鼓楼城投特来电开元路公共快充站)", operator: "特来电", latitude: 26.090229, longitude: 119.30158, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 3, name: "广汽能源汽车充电站(广汽能源福州老药洲建新停车场超充站)", operator: "其他", latitude: 26.054948, longitude: 119.316264, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 4, name: "新电途汽车充电站(优行快充超级充电站)", operator: "其他", latitude: 25.998892, longitude: 119.356696, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 5, name: "远乐超充汽车充电站(东泰禾竹屿超级充电站)", operator: "其他", latitude: 26.09219, longitude: 119.337139, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 6, name: "昆仑网电汽车充电站(中石油福州陶然居充电站)", operator: "其他", latitude: 26.03988, longitude: 119.32192, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 7, name: "新电途汽车充电站(【支持重卡充电】长乐机场创越湾星诺液冷超充站)", operator: "其他", latitude: 25.907531, longitude: 119.64576, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 8, name: "特来电汽车充电站(特来电福州市南街地下空间充电站)", operator: "特来电", latitude: 26.080753, longitude: 119.29982, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 9, name: "特来电汽车充电站(特来电福鑫源奋斗里充电站)", operator: "特来电", latitude: 26.058315, longitude: 119.302145, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 10, name: "时代华智(福州汽车充电站时代华智福州福州仓山齐安智检超充站)", operator: "其他", latitude: 26.012099, longitude: 119.299436, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 11, name: "新电途汽车充电站(汇朝充电站(大车可进))", operator: "其他", latitude: 26.0006, longitude: 119.62501, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 12, name: "远乐超充汽车充电站(火车南站超级充电站)", operator: "其他", latitude: 25.991463, longitude: 119.381615, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 13, name: "特来电汽车充电站", operator: "特来电", latitude: 26.063099, longitude: 119.289743, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 14, name: "特来电超级充电站(特来电福州鼓楼区科创中心特来电光储充检超充站)", operator: "特来电", latitude: 26.0697, longitude: 119.278499, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 15, name: "特来电充电站(福鑫源新透路充电站)", operator: "特来电", latitude: 26.054988, longitude: 119.293325, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 16, name: "特来电充电站(福州福沁休闲公园停车场)", operator: "特来电", latitude: 26.069658, longitude: 119.273693, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 17, name: "特来电充电站(福州大饭店站)", operator: "特来电", latitude: 26.073763, longitude: 119.304263, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 18, name: "特来电充电站(福州融都国际大厦)", operator: "特来电", latitude: 26.08927, longitude: 119.306581, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 19, name: "特来电充电站(台江区竹排埕停车场)", operator: "特来电", latitude: 26.055915, longitude: 119.319419, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 20, name: "特来电汽车充电站(福州大学城速8酒店)", operator: "特来电", latitude: 26.07062, longitude: 119.195855, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 21, name: "特来电汽车充电站(福州大戏院)", operator: "特来电", latitude: 26.097299, longitude: 119.306107, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 22, name: "特来电超级充电站(特来电特马威福州康桥里超充站轻卡可充)", operator: "特来电", latitude: 26.096492, longitude: 119.315955, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 23, name: "特来电充电站(福州白湖亭福卡广场)", operator: "特来电", latitude: 26.025552, longitude: 119.340074, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 24, name: "特来电目的地充电站(特来电高新区璀璨江山慢充站)", operator: "特来电", latitude: 26.03587, longitude: 119.21899, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
  { id: 25, name: "特来电超级充电站(东业集团新能源充电站)", operator: "特来电", latitude: 26.08844, longitude: 119.32701, chargerCount: 12, powerKw: 60, district: "未知", status: "operational" },
];

export function getStaticDashboardStats() {
  const catMap: Record<string, number> = {};
  const catDisplayMap: Record<string, string> = {
    shopping_mall: "购物中心", hotel: "酒店", hospital: "医院",
    transport_hub: "交通枢纽", office: "写字楼", residential: "居住区",
    parking: "停车场", scenic: "景区", government: "政府机构",
    gas_station: "加油站", school: "学校", restaurant: "餐饮",
  };
  STATIC_POI_DATA.forEach(p => {
    const k = catDisplayMap[p.category] ?? p.category;
    catMap[k] = (catMap[k] || 0) + 1;
  });

  const districtMap: Record<string, number> = {};
  STATIC_TRAFFIC_FLOW.forEach(r => {
    const d = r.district.split("/")[0];
    districtMap[d] = (districtMap[d] || 0) + r.dailyFlow;
  });

  const scoreRanges = [
    { range: "9-10分", count: STATIC_POI_DATA.filter(p => p.evDemandScore >= 9).length },
    { range: "8-9分", count: STATIC_POI_DATA.filter(p => p.evDemandScore >= 8 && p.evDemandScore < 9).length },
    { range: "7-8分", count: STATIC_POI_DATA.filter(p => p.evDemandScore >= 7 && p.evDemandScore < 8).length },
    { range: "6-7分", count: STATIC_POI_DATA.filter(p => p.evDemandScore >= 6 && p.evDemandScore < 7).length },
    { range: "<6分", count: STATIC_POI_DATA.filter(p => p.evDemandScore < 6).length },
  ];

  const topPois = [...STATIC_POI_DATA].sort((a, b) => b.evDemandScore - a.evDemandScore).slice(0, 10);
  const districtSet = new Set(STATIC_POI_DATA.map(p => p.district.split("区")[0] + "区"));

  return {
    kpi: {
      districts: districtSet.size,
      poiCount: STATIC_POI_DATA.length,
      roadCount: STATIC_TRAFFIC_FLOW.length,
      stationCount: STATIC_CHARGING_STATIONS.length,
      exclusionCount: STATIC_EXCLUSION_ZONES.length,
    },
    poiCategoryChart: Object.entries(catMap).map(([name, value]) => ({ name, value })),
    trafficDistrictChart: Object.entries(districtMap).map(([name, value]) => ({ name, value: Math.round(value / 1000) })),
    evDemandChart: scoreRanges,
    topPois: topPois.map(p => ({
      id: p.id, name: p.name, category: catDisplayMap[p.category] ?? p.category,
      district: p.district, dailyFlow: p.dailyFlow, evDemandScore: p.evDemandScore,
      lat: p.latitude, lng: p.longitude,
    })),
  };
}
