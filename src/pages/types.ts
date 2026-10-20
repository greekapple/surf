import type {DataStore} from '../hooks/useAppData';
import type {ForecastState} from '../hooks/useForecast';
export interface PageProps {data:DataStore;view:ForecastState;onNavigate?:(page:import('../hooks/usePageNavigation').Page)=>void;onOpen:(id:string,day?:number,hour?:number)=>void}
