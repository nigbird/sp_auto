
"use client";

import {
  Bell,
  Download,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SidebarTrigger } from "./ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getNotifications } from "@/lib/data";
import type { Notification, Pillar, Objective, Initiative, Activity } from "@/lib/types";
import { useEffect, useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import * as XLSX from 'xlsx';

function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    getNotifications().then(setNotifications);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between">
          <p className="font-medium">Notifications</p>
          <Button variant="link" size="sm" className="p-0 h-auto">Mark all as read</Button>
        </div>
        <div className="mt-4 space-y-4">
          {notifications.map((notification) => (
             <div className="flex items-start gap-3" key={notification.id}>
              <div className={`mt-1 h-2 w-2 rounded-full ${notification.read ? '' : 'bg-accent'}`} />
              <div>
                <p className="text-sm">{notification.message}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(notification.date, { addSuffix: true })}</p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}


export function Header() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    window.dispatchEvent(new CustomEvent('export-strategic-plan'));
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        const hierarchy = buildHierarchy(json);
        
        window.dispatchEvent(new CustomEvent('import-strategic-plan', { detail: hierarchy }));

      } catch (error) {
        console.error("Failed to parse file", error);
        alert("Error: Could not parse the imported file. Please ensure it's a valid Excel/CSV file with the correct structure.");
      }
    };
    reader.readAsArrayBuffer(file);
     // Reset file input to allow re-uploading the same file
    event.target.value = '';
  };
  
  const buildHierarchy = (data: any[]): Pillar[] => {
    const pillars: { [key: string]: Pillar } = {};

    data.forEach(row => {
        const pillarName = row['Pillar'];
        const objectiveName = row['Objective'];
        const initiativeName = row['Initiative'];
        const activityName = row['Activity'];
        const activityWeight = parseInt(row['Weight'], 10) || 0;

        if (!pillarName) return;

        if (!pillars[pillarName]) {
            pillars[pillarName] = {
                id: `P-${Date.now()}-${Math.random()}`,
                title: pillarName,
                objectives: []
            };
        }
        const pillar = pillars[pillarName];

        let objective = pillar.objectives.find(o => o.title === objectiveName);
        if (!objective && objectiveName) {
            objective = {
                id: `O-${Date.now()}-${Math.random()}`,
                title: objectiveName,
                weight: 0, // Will be calculated
                initiatives: []
            };
            pillar.objectives.push(objective);
        }

        let initiative = objective?.initiatives.find(i => i.title === initiativeName);
        if (!initiative && objective && initiativeName) {
            initiative = {
                id: `I-${Date.now()}-${Math.random()}`,
                title: initiativeName,
                weight: 0, // Will be calculated
                activities: []
            };
            objective.initiatives.push(initiative);
        }

        if (initiative && activityName) {
            const activity: Activity = {
                id: `A-${Date.now()}-${Math.random()}`,
                title: activityName,
                weight: activityWeight,
                progress: 0,
                description: "",
                department: "N/A",
                responsible: "N/A",
                startDate: new Date(),
                endDate: new Date(),
                status: "Not Started",
                kpis: [],
                updates: [],
                lastUpdated: { user: "Importer", date: new Date() }
            };
            initiative.activities.push(activity);
        }
    });

    return Object.values(pillars);
  };


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
      </div>

      <div className="flex w-full items-center gap-4 md:ml_auto md:gap-2 lg:gap-4">
        <form className="ml-auto flex-1 sm:flex-initial">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search activities..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
            />
          </div>
        </form>
        <Button variant="outline" size="sm" onClick={handleImportClick}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx, .xls, .csv"
          className="hidden"
        />
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Notifications />
      </div>
    </header>
  );
}
