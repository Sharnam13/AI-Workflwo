import { tier1Cities } from "../datas/metro.js";
import { tier2Cities } from "../datas/urban.js";
import { tier3Cities } from "../datas/semi_urban.js";
const locationClassifier=(location)=>{
  if(tier1Cities.includes(location)){
    return "METRO";
  }  else if(tier2Cities.includes(location)){
    return "URBAN";
  }
  else if(tier3Cities.includes(location)){
    return "SEMI_URBAN";
  }
  else{
    return "REMOTE";
  }
}
export {locationClassifier}