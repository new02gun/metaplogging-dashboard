// ============================================================
// 지역별 파이 차트 - 역지오코딩 (Nominatim / OpenStreetMap)
// ============================================================

// 테스트용 더미 좌표 (실제 DB 연동 시 이 함수를 교체)
function generateDummyPhotoCoords() {
  const spots = [
    { lat: 37.5665, lng: 126.978 },   // 중구 (시청)
    { lat: 37.5512, lng: 126.9882 },  // 중구 (남산)
    { lat: 37.5219, lng: 127.1265 },  // 송파구 (잠실)
    { lat: 37.5796, lng: 126.977 },   // 종로구 (경복궁)
    { lat: 37.5443, lng: 127.0557 },  // 성동구 (성수)
    { lat: 37.4979, lng: 127.0276 },  // 강남구
    { lat: 37.5172, lng: 127.0473 },  // 강남구
    { lat: 37.5340, lng: 126.9937 },  // 용산구
    { lat: 37.5888, lng: 127.0161 },  // 동대문구
    { lat: 37.5505, lng: 126.9252 }   // 마포구
  ];

  function seededRand(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  const coords = [];
  spots.forEach((spot, si) => {
    const count = 3 + Math.round(seededRand(si + 1) * 5);
    for (let i = 0; i < count; i++) {
      coords.push({
        lat: spot.lat + (seededRand(si * 100 + i) - 0.5) * 0.008,
        lng: spot.lng + (seededRand(si * 100 + i + 50) - 0.5) * 0.008
      });
    }
  });
  return coords;
}

// 좌표를 100m 단위로 반올림하여 캐시 키 생성
function coordCacheKey(lat, lng) {
  return `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`;
}

// 단일 좌표 → 구/군 이름 (Nominatim 역지오코딩)
async function reverseGeocodeToDistrict(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MetaPloggingDashboard/1.0 (singchoi12@gmail.com)" }
    });
    if (!res.ok) return "알 수 없음";
    const data = await res.json();
    const addr = data.address || {};
    // borough(자치구) → city_district → suburb → county 순으로 fallback
    return addr.borough || addr.city_district || addr.suburb || addr.county || "알 수 없음";
  } catch {
    return "알 수 없음";
  }
}

// 좌표 배열 일괄 역지오코딩 (초당 1회 제한 + 캐시)
async function reverseGeocodeBatch(coords, onProgress) {
  const cache = {};
  const results = [];
  let done = 0;

  for (const coord of coords) {
    const key = coordCacheKey(coord.lat, coord.lng);
    if (cache[key]) {
      results.push(cache[key]);
    } else {
      const district = await reverseGeocodeToDistrict(coord.lat, coord.lng);
      cache[key] = district;
      results.push(district);
      await new Promise((r) => setTimeout(r, 1100)); // Nominatim 정책: 초당 1회
    }
    done++;
    if (onProgress) onProgress(done, coords.length);
  }

  return results;
}

// 구/군 단위 집계 → 파이차트용 labels, values 반환
async function generateDistrictPieData(onProgress) {
  const coords = generateDummyPhotoCoords();
  const districts = await reverseGeocodeBatch(coords, onProgress);

  const tally = {};
  districts.forEach((d) => {
    tally[d] = (tally[d] || 0) + 1;
  });

  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  return {
    labels: sorted.map(([k]) => k),
    values: sorted.map(([, v]) => v)
  };
}
