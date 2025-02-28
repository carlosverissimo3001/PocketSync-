import { useState, useEffect, useRef } from 'react';
import { PlusIcon } from 'lucide-react';
import CenterInput from '../ui/center-input';

interface NewListCardProps {
    onAdd: (name: string) => void;
}

export const NewListCard = ({ onAdd }: NewListCardProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = () => {
        if (name.trim()) {
            onAdd(name.trim());
            setName('');
            setIsEditing(false);
        }
    };

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
        }
    }, [isEditing]);

    return (
        <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 min-h-[40px] w-[200px] backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 hover:border-gray-300/50 dark:hover:border-gray-600/50 transition-all">
            {isEditing ? (
                <form onSubmit={(e) => {e.preventDefault(); handleSubmit()}} className="flex h-full">
                    <CenterInput
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder=""
                        className="text-gray-700 dark:text-gray-300 placeholder-gray-500 dark:placeholder-gray-400"
                        onBlur={() => !name && setIsEditing(false)}
                        onEnter={() => handleSubmit()}
                    />
                </form>
            ) : (
                <button
                    onClick={() => setIsEditing(true)}
                    className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-md transition-all duration-200"
                >
                    <div className="flex items-center gap-2">
                        <PlusIcon className="w-4 h-4" />
                        <span>Create new list</span>
                    </div>
                </button>
            )}
        </div>
    );
}; 