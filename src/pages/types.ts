import type {DataStore} from '../hooks/useAppData';
import type {ForecastState} from '../hooks/useForecast';
export interface PageProps {focusedBoardId?:string|null;onBoardOpen?:(id:string)=>void;mapOpen?:boolean;onMapToggle?:(open:boolean)=>void;activePage?:import('../hooks/usePageNavigation').Page;data:DataStore;view:ForecastState;onNavigate?:(page:import('../hooks/usePageNavigation').Page)=>void;onOpen:(id:string,day?:number,hour?:number)=>void}
