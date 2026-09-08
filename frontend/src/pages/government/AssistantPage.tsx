import Topbar from "../../components/Topbar";
import AIAssistant from "../../components/AIAssistant";
export default function AssistantPage(){
  return <><Topbar title="AI Assistant" />
    <div className="p-6 max-w-3xl mx-auto"><AIAssistant /></div>
  </>;
}
